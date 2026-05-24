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
