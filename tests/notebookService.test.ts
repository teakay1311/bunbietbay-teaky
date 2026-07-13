import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichNotebookMembers, mapNotebookMembers, mapNotebookPlaces, toRemoteNotebookPlaceUpdate } from '../src/data/notebookMappers';

test('normalizes notebook rows and rejects malformed role rows', () => {
  assert.deepEqual(mapNotebookMembers([
    { id: 'm1', notebook_id: 'n1', user_id: 'u1', role: 'editor' },
    { id: 'm2', notebook_id: 'n1', user_id: 'u2', role: 'invalid' },
  ]), [{ id: 'm1', notebookId: 'n1', userId: 'u1', role: 'editor' }]);

  const [place] = mapNotebookPlaces([{ id: 'p1', notebook_id: 'n1', name: 'Cafe', type: 'cafe', rating: '4', created_at: '2026-01-01' }]);
  assert.equal(place.rating, 4);
  assert.equal(place.updatedAt, '2026-01-01');
});

test('notebook update mapper omits absent fields', () => {
  assert.deepEqual(toRemoteNotebookPlaceUpdate({ name: 'New', photos: [] }), { name: 'New', photos: [] });
  assert.deepEqual(toRemoteNotebookPlaceUpdate({ coverImage: undefined }), { cover_image: null });
});

test('enriches notebook members with the profiles avatar_url schema column', () => {
  assert.deepEqual(enrichNotebookMembers(
    [{ id: 'm1', notebookId: 'n1', userId: 'u1', role: 'owner' }],
    [{ id: 'u1', display_name: 'An', email: 'an@example.com', avatar_url: 'https://example.com/an.png' }],
  )[0], {
    id: 'm1', notebookId: 'n1', userId: 'u1', role: 'owner',
    displayName: 'An', email: 'an@example.com', avatar: 'https://example.com/an.png',
  });
});
