import path from 'node:path'

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export function validateMediaFile(
  mimetype: string,
  sizeBytes: number,
): { valid: boolean; error?: string } {
  const isAllowedType = (ALLOWED_MIME_TYPES as readonly string[]).includes(mimetype)
  if (!isAllowedType) {
    return {
      valid: false,
      error: `Unsupported MIME type: ${mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size ${sizeBytes} bytes exceeds maximum of ${MAX_FILE_SIZE_BYTES} bytes (10MB)`,
    }
  }

  return { valid: true }
}

export function generateObjectKey(
  mediaId: string,
  filename: string,
  mimeType: string,
): string {
  const ext = MIME_TO_EXT[mimeType as AllowedMimeType]
  const basename = path.parse(filename).name
  const resolvedExt = ext ?? path.extname(filename).replace('.', '')
  return `media/${mediaId}/${basename}.${resolvedExt}`
}
