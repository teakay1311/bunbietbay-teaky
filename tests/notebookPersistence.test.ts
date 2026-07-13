import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalNotebookState, writeLocalNotebookState } from '../src/data/notebookPersistence';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

test('migrates legacy local notebook places without dates or notebook id', () => {
  const storage = createStorage({
    bunbietbay_notebook_places: JSON.stringify([{ id: 'p1', name: 'Cafe', type: 'cafe', rating: 5 }]),
  });
  const state = readLocalNotebookState(storage);
  assert.equal(state.notebooks[0].id, 'default-personal');
  assert.equal(state.places[0].notebookId, 'default-personal');
  assert.match(state.places[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(state.places[0].updatedAt, state.places[0].createdAt);
});

test('persists deletion of the final local notebook place', () => {
  const storage = createStorage({
    bunbietbay_notebook_places: JSON.stringify([{ id: 'p1' }]),
  });
  assert.equal(writeLocalNotebookState([], [], storage), true);
  assert.deepEqual(JSON.parse(storage.getItem('bunbietbay_notebook_places') ?? '[]'), []);
});
