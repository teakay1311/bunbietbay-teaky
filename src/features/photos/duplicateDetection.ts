export const PHOTO_HASH_VERSION = 1;

export async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function hammingDistance(left: string, right: string) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const xor = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    distance += xor.toString(2).replaceAll('0', '').length;
  }
  return distance;
}

export async function createPerceptualHash(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 9;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Trình duyệt không hỗ trợ kiểm tra ảnh trùng.');
  context.drawImage(bitmap, 0, 0, 9, 8);
  bitmap.close();
  const pixels = context.getImageData(0, 0, 9, 8).data;
  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const offset = (y * 9 + x) * 4;
      const nextOffset = offset + 4;
      const luminance = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
      const nextLuminance = pixels[nextOffset] * 0.299 + pixels[nextOffset + 1] * 0.587 + pixels[nextOffset + 2] * 0.114;
      bits += luminance > nextLuminance ? '1' : '0';
    }
  }
  return bits.match(/.{4}/g)!.map((chunk) => Number.parseInt(chunk, 2).toString(16)).join('');
}

export async function hashPhoto(blob: Blob) {
  const contentHash = await sha256Hex(blob);
  let perceptualHash: string | undefined;
  try { perceptualHash = await createPerceptualHash(blob); } catch { /* exact detection remains available */ }
  return { contentHash, perceptualHash, hashVersion: PHOTO_HASH_VERSION };
}

export async function inspectDuplicateFiles(files: File[], existingPhotos: Array<{ id: string; tripId: string; contentHash?: string; perceptualHash?: string }>, tripId: string) {
  const hashes = new Map<File, Awaited<ReturnType<typeof hashPhoto>>>();
  const matches: Array<{ file: File; photoId: string; exact: boolean; sameTrip: boolean }> = [];
  const selectedHashes: Array<{ file: File; contentHash: string; perceptualHash?: string }> = [];
  for (const file of files) {
    const hash = await hashPhoto(file);
    hashes.set(file, hash);
    const duplicateSelection = selectedHashes.find((item) => item.contentHash === hash.contentHash);
    if (duplicateSelection) {
      matches.push({ file, photoId: `pending:${duplicateSelection.file.name}`, exact: true, sameTrip: true });
      selectedHashes.push({ file, ...hash });
      continue;
    }
    const exact = existingPhotos.find((photo) => photo.contentHash && photo.contentHash === hash.contentHash);
    if (exact) {
      matches.push({ file, photoId: exact.id, exact: true, sameTrip: exact.tripId === tripId });
      continue;
    }
    const near = hash.perceptualHash ? existingPhotos.find((photo) => photo.perceptualHash && hammingDistance(photo.perceptualHash, hash.perceptualHash!) <= 5) : undefined;
    if (near) matches.push({ file, photoId: near.id, exact: false, sameTrip: near.tripId === tripId });
    else if (hash.perceptualHash) {
      const nearSelection = selectedHashes.find((item) => item.perceptualHash && hammingDistance(item.perceptualHash, hash.perceptualHash!) <= 5);
      if (nearSelection) matches.push({ file, photoId: `pending:${nearSelection.file.name}`, exact: false, sameTrip: true });
    }
    selectedHashes.push({ file, ...hash });
  }
  return { hashes, matches };
}
