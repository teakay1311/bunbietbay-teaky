import type { Notebook, NotebookMember, NotebookPlace, PendingNotebookInvitation } from '../domain/models';

export function mapNotebookInvitations(rows: Record<string, unknown>[]): PendingNotebookInvitation[] {
  return rows.flatMap((row) => {
    if (typeof row.id !== 'string' || typeof row.notebook_id !== 'string' || typeof row.email !== 'string'
      || (row.role !== 'admin' && row.role !== 'editor' && row.role !== 'viewer')) return [];
    const notebook = asRecord(row.notebooks);
    const inviter = asRecord(row.inviter);
    return [{
      id: row.id,
      notebookId: row.notebook_id,
      notebookName: typeof notebook.name === 'string' ? notebook.name : 'Thư viện địa điểm',
      email: row.email,
      role: row.role,
      status: row.status === 'accepted' || row.status === 'declined' ? row.status : 'pending',
      createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
      invitedByName: typeof inviter.display_name === 'string' ? inviter.display_name : null,
    }];
  });
}

export function mapNotebookMembers(rows: Record<string, unknown>[]): NotebookMember[] {
  return rows.flatMap((row) => (
    typeof row.id === 'string' && typeof row.notebook_id === 'string' && typeof row.user_id === 'string'
      && (row.role === 'owner' || row.role === 'admin' || row.role === 'editor' || row.role === 'viewer')
      ? [{ id: row.id, notebookId: row.notebook_id, userId: row.user_id, role: row.role }]
      : []
  ));
}

export function enrichNotebookMembers(members: NotebookMember[], rows: Record<string, unknown>[]) {
  const profiles = new Map(rows.flatMap((row) => typeof row.id === 'string' ? [[row.id, row]] : []));
  return members.map((member) => {
    const profile = profiles.get(member.userId);
    return {
      ...member,
      displayName: typeof profile?.display_name === 'string' ? profile.display_name : undefined,
      email: typeof profile?.email === 'string' ? profile.email : undefined,
      avatar: typeof profile?.avatar_url === 'string' ? profile.avatar_url : undefined,
    };
  });
}

export function mapNotebooks(rows: Record<string, unknown>[]): Notebook[] {
  return rows.flatMap((row) => (
    typeof row.id === 'string' && typeof row.name === 'string' && (row.type === 'personal' || row.type === 'shared')
      ? [{
        id: row.id,
        name: row.name,
        type: row.type,
        createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
        createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
      }]
      : []
  ));
}

export function mapNotebookPlaces(rows: Record<string, unknown>[]): NotebookPlace[] {
  return rows.flatMap((row) => {
    if (typeof row.id !== 'string' || typeof row.notebook_id !== 'string' || typeof row.name !== 'string'
      || (row.type !== 'hotel' && row.type !== 'restaurant' && row.type !== 'cafe' && row.type !== 'entertainment' && row.type !== 'other')) return [];
    const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
    return [{
      id: row.id,
      notebookId: row.notebook_id,
      name: row.name,
      type: row.type,
      address: typeof row.address === 'string' ? row.address : undefined,
      phone: typeof row.phone === 'string' ? row.phone : undefined,
      note: typeof row.note === 'string' ? row.note : undefined,
      rating: Number(row.rating) || 5,
      customFields: Array.isArray(row.custom_fields) ? row.custom_fields as NotebookPlace['customFields'] : undefined,
      coverImage: typeof row.cover_image === 'string' ? row.cover_image : undefined,
      photos: Array.isArray(row.photos) ? row.photos.filter((photo): photo is string => typeof photo === 'string') : [],
      createdAt,
      createdBy: typeof row.created_by === 'string' ? row.created_by : undefined,
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : createdAt,
    }];
  });
}

export function toRemoteNotebookPlace(notebookId: string, place: Pick<NotebookPlace, 'name' | 'type' | 'address' | 'phone' | 'note' | 'rating' | 'customFields' | 'coverImage' | 'photos'>, createdBy: string, id?: string) {
  return {
    ...(id ? { id } : {}), notebook_id: notebookId, name: place.name, type: place.type,
    address: place.address, phone: place.phone, note: place.note, rating: place.rating,
    custom_fields: place.customFields || [], cover_image: place.coverImage, photos: place.photos || [], created_by: createdBy,
  };
}

export function toRemoteNotebookPlaceUpdate(place: Partial<NotebookPlace>) {
  return Object.fromEntries(Object.entries({
    name: place.name, type: place.type, address: place.address, phone: place.phone, note: place.note,
    rating: place.rating, custom_fields: place.customFields,
    ...('coverImage' in place ? { cover_image: place.coverImage ?? null } : {}),
    photos: place.photos,
  }).filter(([, value]) => value !== undefined));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
