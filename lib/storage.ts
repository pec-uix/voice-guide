import { v2 as cloudinary } from 'cloudinary';

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return { error: 'Cloudinary credentials not configured' };
  }

  configure();

  // Strip extension — Cloudinary manages its own format/extension
  const publicId = filename.replace(/\.[^/.]+$/, '');

  try {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'video', public_id: publicId },
        (error, result) => {
          if (error || !result) reject(error ?? new Error('No result'));
          else resolve(result);
        },
      );
      stream.end(buffer);
    });

    return { url: result.secure_url };
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    return { error: 'Upload failed' };
  }
}
