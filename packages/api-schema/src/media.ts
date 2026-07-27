import { z } from 'zod';
import { isoDatetime } from './common.js';

// ---------------------------------------------------------------------------
// Allowed MIME types for event artwork (Version One)
// ---------------------------------------------------------------------------

export const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const mediaMimeType = z.enum(allowedMimeTypes);

export type MediaMimeType = z.infer<typeof mediaMimeType>;

// ---------------------------------------------------------------------------
// Upload purpose
// ---------------------------------------------------------------------------

export const uploadPurpose = z.enum([
  'event_artwork',
  'event_banner',
  'organization_logo',
  'user_avatar',
]);

export type UploadPurpose = z.infer<typeof uploadPurpose>;

// ---------------------------------------------------------------------------
// POST /media/uploads  — create signed upload request
// ---------------------------------------------------------------------------

export const createUploadBody = z.object({
  purpose: uploadPurpose,
  filename: z.string().min(1).max(256),
  mimeType: mediaMimeType,
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), // 10 MB hard limit
});

export type CreateUploadBody = z.infer<typeof createUploadBody>;

export const createUploadResponse = z.object({
  data: z.object({
    mediaId: z.string(),
    uploadMethod: z.literal('PUT'),
    uploadUrl: z.string().url(),
    headers: z.record(z.string()),
    expiresAt: isoDatetime,
  }),
});

export type CreateUploadResponse = z.infer<typeof createUploadResponse>;

// ---------------------------------------------------------------------------
// Completed media resource
// ---------------------------------------------------------------------------

export const mediaSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'available', 'rejected', 'deleted']),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  url: z.string().url(),
  createdAt: isoDatetime,
});

export type MediaSchema = z.infer<typeof mediaSchema>;

// ---------------------------------------------------------------------------
// POST /media/:mediaId/complete
// ---------------------------------------------------------------------------

// No body required — the server validates by fetching from storage.
export const completeUploadResponse = z.object({
  data: mediaSchema,
});

export type CompleteUploadResponse = z.infer<typeof completeUploadResponse>;
