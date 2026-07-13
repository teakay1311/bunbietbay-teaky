import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNotebook, getNotebookPermissions } from '../src/domain/notebookPermissions';

test('maps notebook roles to edit, invite and delete permissions', () => {
  assert.deepEqual(getNotebookPermissions('owner'), { canEditNotebook: true, canEditPlaces: true, canInvite: true, canManageMembers: true, canDeleteNotebook: true });
  assert.equal(getNotebookPermissions('admin').canInvite, true);
  assert.equal(getNotebookPermissions('editor').canEditPlaces, true);
  assert.deepEqual(getNotebookPermissions('viewer'), { canEditNotebook: false, canEditPlaces: false, canInvite: false, canManageMembers: false, canDeleteNotebook: false });
});

test('derives notebook ownership and preserves the legacy personal-library label', () => {
  const notebook = calculateNotebook(
    { id: 'default-personal', name: 'Sổ tay cá nhân', type: 'personal' },
    undefined,
    [],
  );
  assert.equal(notebook.name, 'Địa điểm của tôi');
  assert.equal(notebook.membershipRole, 'owner');
  assert.equal(notebook.permissions.canDeleteNotebook, true);
});
