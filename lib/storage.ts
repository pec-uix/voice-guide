async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToCloudinary(
  buffer: Buffer,
  publicId: string,
  resourceType: 'image' | 'video',
  mimeType?: string,
): Promise<{ url: string } | { error: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { error: 'Cloudinary credentials not configured' };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), 'upload');
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('api_key', apiKey);
  form.append('signature', signature);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error('Cloudinary error:', text);
      return { error: 'Upload failed' };
    }
    const json = await res.json() as { secure_url: string };
    return { url: json.secure_url };
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    return { error: 'Upload failed' };
  }
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
): Promise<{ url: string } | { error: string }> {
  const publicId = filename.replace(/\.[^/.]+$/, '');
  return uploadToCloudinary(buffer, publicId, 'image');
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  const publicId = filename.replace(/\.[^/.]+$/, '');
  return uploadToCloudinary(buffer, publicId, 'video', contentType);
}
