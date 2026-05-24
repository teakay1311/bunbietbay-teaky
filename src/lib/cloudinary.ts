const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
const cloudinaryFolder = import.meta.env.VITE_CLOUDINARY_FOLDER?.trim();
const cloudinaryDeleteEndpoint = import.meta.env.VITE_CLOUDINARY_DELETE_ENDPOINT?.trim();

export const isCloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryUploadPreset);

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

export async function uploadImageToCloudinary(file: Blob, options?: { folder?: string; tags?: string[] }) {
  if (!isCloudinaryConfigured || !cloudinaryCloudName || !cloudinaryUploadPreset) {
    throw new Error('Cloudinary chưa được cấu hình');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryUploadPreset);

  const folder = options?.folder ?? cloudinaryFolder;
  if (folder) {
    formData.append('folder', folder);
  }

  if (options?.tags?.length) {
    formData.append('tags', options.tags.join(','));
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed with status ${response.status}`);
  }

  const payload = await response.json() as CloudinaryUploadResponse;
  return {
    url: payload.secure_url,
    publicId: payload.public_id,
  };
}

export async function deleteImageFromCloudinary(publicId: string) {
  if (!cloudinaryDeleteEndpoint) {
    return false;
  }
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(cloudinaryDeleteEndpoint);
  } catch {
    throw new Error('Cloudinary delete endpoint không hợp lệ');
  }
  const isSecure = endpointUrl.protocol === 'https:' || endpointUrl.hostname === 'localhost' || endpointUrl.hostname === '127.0.0.1';
  if (!isSecure) {
    throw new Error('Cloudinary delete endpoint phải dùng HTTPS (hoặc localhost)');
  }

  const response = await fetch(cloudinaryDeleteEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicId }),
  });

  if (!response.ok) {
    throw new Error(`Cloudinary delete failed with status ${response.status}`);
  }

  return true;
}
