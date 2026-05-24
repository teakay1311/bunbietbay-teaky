import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, getPhotoStorageSummary, shouldWarnAboutEmbeddedStorage } from '../src/utils/photoStorage';

test('summarizes embedded and remote photos separately', () => {
  const summary = getPhotoStorageSummary([
    {
      id: 'p1',
      tripId: 't1',
      url: 'data:image/webp;base64,AAAA',
      album: 'Chung',
      createdAt: '2026-04-10T00:00:00.000Z',
      storage: 'embedded',
    },
    {
      id: 'p2',
      tripId: 't1',
      url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      album: 'Cloud',
      createdAt: '2026-04-10T00:00:00.000Z',
      storage: 'remote',
      provider: 'cloudinary',
    },
  ]);

  assert.equal(summary.totalCount, 2);
  assert.equal(summary.embeddedCount, 1);
  assert.equal(summary.remoteCount, 1);
  assert.ok(summary.estimatedEmbeddedBytes > 0);
});

test('formats byte values for UI display', () => {
  assert.equal(formatBytes(980), '980 B');
  assert.equal(formatBytes(1024), '1.0 KB');
});

test('warns when embedded photo storage exceeds soft threshold', () => {
  const oversizedDataUrl = `data:image/webp;base64,${'A'.repeat(60 * 1024 * 1024)}`;
  const shouldWarn = shouldWarnAboutEmbeddedStorage([
    {
      id: 'p1',
      tripId: 't1',
      url: oversizedDataUrl,
      album: 'Chung',
      createdAt: '2026-04-10T00:00:00.000Z',
      storage: 'embedded',
    },
  ]);

  assert.equal(shouldWarn, true);
});
