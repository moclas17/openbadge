/**
 * Media upload workflow (API.md §21):
 *   1. POST /media/uploads    -> create a pending Media row + signed PUT URL.
 *   2. Client uploads directly to object storage.
 *   3. POST /media/{id}/complete -> server verifies the object (existence,
 *      size, content-based MIME sniffing, image dimensions, checksum) and
 *      flips the Media status to `available`.
 */
import crypto from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '@openbadge/database';
import { generateMediaId } from '@openbadge/domain';
import { generateObjectKey } from '@openbadge/storage';
import type { CreateUploadBody } from '@openbadge/api-schema';
import { config } from '../config.js';
import { AppError, errors } from '../lib/errors.js';
import { iso, mediaUrl } from '../lib/serialize.js';
import { s3 } from '../lib/infra.js';

const UPLOAD_URL_TTL_SECONDS = 900; // 15 minutes

// ---------------------------------------------------------------------------
// Content-based MIME sniffing + dimension extraction (PNG / JPEG / WEBP)
// ---------------------------------------------------------------------------

interface ImageInfo {
  mimeType: string;
  width: number | null;
  height: number | null;
}

function sniffImage(buf: Buffer): ImageInfo | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR at offset 16
  if (
    buf.length > 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return {
      mimeType: 'image/png',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }

  // JPEG: FF D8 — scan segments for a SOFn marker carrying dimensions.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1] ?? 0;
      const segmentLength = buf.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return {
          mimeType: 'image/jpeg',
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segmentLength;
    }
    return { mimeType: 'image/jpeg', width: null, height: null };
  }

  // WEBP: RIFF....WEBP
  if (
    buf.length > 30 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const format = buf.toString('ascii', 12, 16);
    if (format === 'VP8X') {
      const width = 1 + (buf.readUIntLE(24, 3) & 0xffffff);
      const height = 1 + (buf.readUIntLE(27, 3) & 0xffffff);
      return { mimeType: 'image/webp', width, height };
    }
    if (format === 'VP8 ') {
      return {
        mimeType: 'image/webp',
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
      };
    }
    if (format === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return {
        mimeType: 'image/webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return { mimeType: 'image/webp', width: null, height: null };
  }

  return null;
}

async function readObjectBytes(bucket: string, key: string): Promise<Buffer> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = result.Body;
  if (!body) throw errors.mediaNotAvailable();
  const bytes = await body.transformToByteArray();
  return Buffer.from(bytes);
}

function serializeMedia(media: {
  id: string;
  status: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  bucket: string;
  object_key: string;
  created_at: Date;
}) {
  return {
    id: media.id,
    status: media.status,
    mimeType: media.mime_type,
    sizeBytes: media.size_bytes,
    width: media.width,
    height: media.height,
    url: mediaUrl(media),
    createdAt: iso(media.created_at),
  };
}

export const MediaService = {
  /**
   * Creates a pending Media record and returns a signed PUT URL.
   */
  async createUpload(userId: string, input: CreateUploadBody) {
    const mediaId = generateMediaId();
    const objectKey = generateObjectKey(mediaId, input.filename, input.mimeType);

    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: objectKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    const expiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

    await db.media.create({
      data: {
        id: mediaId,
        storage_provider: 's3',
        bucket: config.s3Bucket,
        object_key: objectKey,
        original_filename: input.filename,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        checksum: '',
        status: 'pending',
        created_by_user_id: userId,
      },
    });

    return {
      mediaId,
      uploadMethod: 'PUT' as const,
      uploadUrl,
      headers: { 'Content-Type': input.mimeType },
      expiresAt: iso(expiresAt),
    };
  },

  /**
   * Verifies the uploaded object and marks the Media as available.
   */
  async completeUpload(mediaId: string, userId: string) {
    const media = await db.media.findFirst({
      where: { id: mediaId, deleted_at: null },
    });
    if (!media) throw errors.notFound('Media');
    if (media.created_by_user_id !== userId) throw errors.permissionDenied();
    if (media.status === 'available') return serializeMedia(media);
    if (media.status !== 'pending') throw errors.mediaNotAvailable();

    // 1. Object existence + declared size
    let headSize: number | undefined;
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: media.bucket, Key: media.object_key }),
      );
      headSize = head.ContentLength;
    } catch {
      throw new AppError('UPLOAD_NOT_FOUND', 422, 'The uploaded object was not found in storage.');
    }

    const bytes = await readObjectBytes(media.bucket, media.object_key);
    const actualSize = headSize ?? bytes.length;
    if (actualSize !== media.size_bytes) {
      await db.media.update({ where: { id: mediaId }, data: { status: 'rejected' } });
      throw new AppError('UPLOAD_SIZE_MISMATCH', 422, 'Uploaded file size does not match the declared size.');
    }

    // 2. Content-based MIME + dimensions
    const info = sniffImage(bytes);
    if (!info || info.mimeType !== media.mime_type) {
      await db.media.update({ where: { id: mediaId }, data: { status: 'rejected' } });
      throw new AppError(
        'UPLOAD_MIME_MISMATCH',
        422,
        'Uploaded file content does not match the declared MIME type.',
      );
    }

    // 3. Checksum
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');

    const updated = await db.media.update({
      where: { id: mediaId },
      data: {
        status: 'available',
        width: info.width,
        height: info.height,
        checksum,
      },
    });
    return serializeMedia(updated);
  },
};
