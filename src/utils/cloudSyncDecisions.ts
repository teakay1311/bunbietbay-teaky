export function hasUnsyncedLocalChanges(lastSyncedHash: string | null, currentHash: string) {
  return lastSyncedHash !== currentHash;
}

export function shouldOpenSyncConflict(params: {
  remoteUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncedHash: string | null;
  currentHash: string;
}) {
  const { remoteUpdatedAt, lastSyncedAt, lastSyncedHash, currentHash } = params;

  if (!remoteUpdatedAt) {
    return false;
  }

  const remoteUpdatedAtMs = Date.parse(remoteUpdatedAt);
  const lastSyncedAtMs = lastSyncedAt ? Date.parse(lastSyncedAt) : NaN;
  const isRemoteNewer = Number.isFinite(remoteUpdatedAtMs)
    ? (!Number.isFinite(lastSyncedAtMs) || remoteUpdatedAtMs > lastSyncedAtMs)
    : (!lastSyncedAt || remoteUpdatedAt > lastSyncedAt);
  return isRemoteNewer && hasUnsyncedLocalChanges(lastSyncedHash, currentHash);
}

export type RemoteWorkspaceErrorCode = 'schema-incompatible' | 'auth' | 'permission' | 'network' | 'unknown';

export function classifyRemoteWorkspaceError(error: unknown): RemoteWorkspaceErrorCode {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const code = String(record.code ?? record.status ?? '').toLowerCase();
  const message = String(record.message ?? error ?? '').toLowerCase();

  if (code === '42703' || code === 'pgrst204'
    || message.includes('schema cache') || message.includes('does not exist')
    || message.includes('column') && message.includes('revoked_at') || message.includes('relation')) {
    return 'schema-incompatible';
  }
  if (code === '401' || code === 'pgrst301' || message.includes('jwt') || message.includes('not authenticated')) {
    return 'auth';
  }
  if (code === '403' || code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'permission';
  }
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
    return 'network';
  }
  return 'unknown';
}
