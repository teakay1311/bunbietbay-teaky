import type { Notebook, NotebookPlace } from '../domain/models';

export const DEFAULT_PERSONAL_NOTEBOOK: Notebook = { id: 'default-personal', name: 'Địa điểm của tôi', type: 'personal' };

export function readLocalNotebookState(storage: Pick<Storage, 'getItem'> = localStorage) {
  const notebooks = parseArray<Notebook>(storage.getItem('bunbietbay_notebooks'));
  const places = parseArray<Partial<NotebookPlace> & Pick<NotebookPlace, 'id' | 'name' | 'type' | 'rating'>>(storage.getItem('bunbietbay_notebook_places'));
  const migratedAt = new Date().toISOString();
  return {
    notebooks: ensurePersonalNotebook(notebooks),
    places: places.map((place) => {
      const createdAt = typeof place.createdAt === 'string' ? place.createdAt : migratedAt;
      return {
        ...place,
        notebookId: place.notebookId || DEFAULT_PERSONAL_NOTEBOOK.id,
        createdAt,
        updatedAt: typeof place.updatedAt === 'string' ? place.updatedAt : createdAt,
      } as NotebookPlace;
    }),
  };
}

export function writeLocalNotebookState(notebooks: Notebook[], places: NotebookPlace[], storage: Pick<Storage, 'setItem'> = localStorage) {
  storage.setItem('bunbietbay_notebook_places', JSON.stringify(places));
  storage.setItem('bunbietbay_notebooks', JSON.stringify(notebooks));
  return true;
}

export function ensurePersonalNotebook(notebooks: Notebook[]) {
  return notebooks.some((notebook) => notebook.type === 'personal')
    ? notebooks
    : [DEFAULT_PERSONAL_NOTEBOOK, ...notebooks];
}

function parseArray<T>(rawValue: string | null): T[] {
  if (!rawValue) return [];
  try {
    const value = JSON.parse(rawValue);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
