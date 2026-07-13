export async function resizeImageFileToDataUrl(file: File, maxSize = 400, quality = 0.8) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  let width = image.width;
  let height = image.height;
  if (width > height && width > maxSize) {
    height *= maxSize / width;
    width = maxSize;
  } else if (height > maxSize) {
    width *= maxSize / height;
    height = maxSize;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/webp', quality);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể xử lý ảnh đại diện.'));
    image.src = source;
  });
}
