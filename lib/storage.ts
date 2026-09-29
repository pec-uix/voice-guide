import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return { error: 'R2 credentials not configured' };
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    }));

    return { url: `${publicUrl.replace(/\/$/, '')}/${filename}` };
  } catch (err) {
    console.error('R2 upload error:', err);
    return { error: 'Upload failed' };
  }
}
