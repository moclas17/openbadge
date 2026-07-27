import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'

export type { S3Client }

export interface S3Config {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  region: string
  forcePathStyle: boolean
  publicUrl: string
}

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  })
}

export async function uploadFile(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  // Return the path-style public URL; caller passes publicUrl from config
  return `${key}`
}

export function getFileUrl(publicUrl: string, bucket: string, key: string): string {
  const base = publicUrl.replace(/\/$/, '')
  return `${base}/${bucket}/${key}`
}

export async function deleteFile(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}

export async function fileExists(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
    return true
  } catch (err) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } }
    if (
      error.name === 'NotFound' ||
      error.name === 'NoSuchKey' ||
      error.$metadata?.httpStatusCode === 404
    ) {
      return false
    }
    throw err
  }
}
