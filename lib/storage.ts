// R2 audio upload — requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT
// Stage 6: fill in credentials and uncomment the real upload logic

export async function uploadAudio(
  _buffer: Buffer,
  _filename: string,
  _contentType: string,
): Promise<{ url: string } | { error: string }> {
  if (
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET
  ) {
    return { error: 'R2 credentials not configured' };
  }

  // TODO stage 6: implement S3-compatible upload to Cloudflare R2
  // const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  // const client = new S3Client({ ... });
  // await client.send(new PutObjectCommand({ ... }));
  return { error: 'R2 upload not yet implemented' };
}
