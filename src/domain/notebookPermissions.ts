import type { CalculatedNotebook, Notebook, NotebookMember, NotebookMembershipRole, NotebookPermissions } from './models';

export function getNotebookPermissions(role: NotebookMembershipRole): NotebookPermissions {
  return {
    canEditNotebook: role !== 'viewer',
    canEditPlaces: role !== 'viewer',
    canInvite: role === 'owner' || role === 'admin',
    canManageMembers: role === 'owner' || role === 'admin',
    canDeleteNotebook: role === 'owner',
  };
}

export function calculateNotebook(notebook: Notebook, currentUserId: string | undefined, members: NotebookMember[]): CalculatedNotebook {
  const normalizedNotebook = notebook.name === 'Sổ tay cá nhân' ? { ...notebook, name: 'Địa điểm của tôi' } : notebook;
  const membership = members.find((item) => item.notebookId === notebook.id && item.userId === currentUserId);
  const isLocalOwner = !currentUserId || notebook.id.startsWith('default-') || notebook.id.startsWith('local-');
  const membershipRole: NotebookMembershipRole = isLocalOwner || notebook.createdBy === currentUserId ? 'owner' : membership?.role ?? 'viewer';
  return {
    ...normalizedNotebook,
    membershipRole,
    permissions: getNotebookPermissions(membershipRole),
    memberCount: Math.max(1, members.filter((item) => item.notebookId === notebook.id).length),
  };
}
