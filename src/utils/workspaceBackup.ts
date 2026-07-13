import type { Notebook, NotebookPlace, PersistedAppState, TripNotificationPreferences, UserPreferences, WorkspaceBackupV8 } from '../domain/models';
import { prepareImportedSnapshot } from './appState';
import { normalizeAppBackgroundPreference } from '../data/preferencesService';

export type PreparedWorkspaceBackup = {
  workspace: PersistedAppState;
  library: WorkspaceBackupV8['library'] | null;
  preferences: UserPreferences | null;
  tripNotificationPreferences: TripNotificationPreferences[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertUniqueIds(items: Array<{ id: string }>, label: string) {
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error(`Backup không hợp lệ: ID ${label} bị trùng.`);
}

function isValidDateTime(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function validateLibrary(library: unknown): WorkspaceBackupV8['library'] {
  if (!isRecord(library) || !Array.isArray(library.notebooks) || !Array.isArray(library.places)) throw new Error('Backup không hợp lệ: thiếu dữ liệu Thư viện.');
  const notebooks = library.notebooks as Notebook[];
  const places = library.places as NotebookPlace[];
  if (notebooks.some((item) => !item || !item.id?.trim() || !item.name?.trim() || !['personal', 'shared'].includes(item.type) || (item.createdAt !== undefined && !isValidDateTime(item.createdAt)) || (item.updatedAt !== undefined && !isValidDateTime(item.updatedAt)))) throw new Error('Backup không hợp lệ: bộ sưu tập có dữ liệu sai.');
  if (places.some((item) => !item || !item.id?.trim() || !item.notebookId?.trim() || !item.name?.trim() || !['hotel', 'restaurant', 'cafe', 'entertainment', 'other'].includes(item.type) || !Number.isFinite(item.rating) || item.rating < 0 || item.rating > 5 || !isValidDateTime(item.createdAt) || !isValidDateTime(item.updatedAt) || (item.photos !== undefined && !Array.isArray(item.photos)) || (item.customFields !== undefined && !Array.isArray(item.customFields)))) throw new Error('Backup không hợp lệ: địa điểm Thư viện có dữ liệu sai.');
  assertUniqueIds(notebooks, 'bộ sưu tập');
  assertUniqueIds(places, 'địa điểm Thư viện');
  const notebookIds = new Set(notebooks.map((item) => item.id));
  if (places.some((item) => !notebookIds.has(item.notebookId))) throw new Error('Backup không hợp lệ: địa điểm tham chiếu bộ sưu tập không tồn tại.');
  return { notebooks, places };
}

function validatePreferences(value: unknown): UserPreferences {
  if (!isRecord(value) || !['light', 'dark', 'system'].includes(String(value.themeMode)) || !['cozy', 'compact'].includes(String(value.uiDensity)) || typeof value.themePresetId !== 'string' || !value.themePresetId.trim() || typeof value.isPrivacyMode !== 'boolean' || typeof value.remindersEnabled !== 'boolean' || !isIntegerInRange(value.activityLeadMinutes, 1, 10080) || !isIntegerInRange(value.tripStartLeadMinutes, 1, 20160) || (value.updatedAt !== undefined && !isValidDateTime(value.updatedAt))) throw new Error('Backup không hợp lệ: tùy chỉnh tài khoản có dữ liệu sai.');
  const appBackground = normalizeAppBackgroundPreference(value.appBackground);
  if (value.appBackground !== undefined && isRecord(value.appBackground) && value.appBackground.source !== 'none' && appBackground.source === 'none') throw new Error('Backup không hợp lệ: ảnh nền ứng dụng có dữ liệu sai.');
  return { ...(value as Omit<UserPreferences, 'appBackground'>), appBackground };
}

export function createWorkspaceBackupV8(input: Omit<WorkspaceBackupV8, 'version' | 'exportedAt'>): WorkspaceBackupV8 {
  return {
    version: 8,
    ...input,
    workspace: { ...input.workspace, notifications: [], offlineMutations: [] },
    exportedAt: new Date().toISOString(),
  };
}

export function prepareWorkspaceBackup(raw: unknown): PreparedWorkspaceBackup {
  if (isRecord(raw) && typeof raw.version === 'number' && (raw.version < 1 || raw.version > 8)) throw new Error(`Backup version ${raw.version} chưa được hỗ trợ.`);
  if (!isRecord(raw) || (raw.version !== 7 && raw.version !== 8)) {
    return { workspace: prepareImportedSnapshot(raw as Partial<PersistedAppState>), library: null, preferences: null, tripNotificationPreferences: [] };
  }
  const library = validateLibrary(raw.library);
  const preferences = validatePreferences(raw.preferences);
  if (!isValidDateTime(raw.exportedAt)) throw new Error('Backup không hợp lệ: thời điểm xuất dữ liệu không hợp lệ.');
  if (!Array.isArray(raw.tripNotificationPreferences)) throw new Error('Backup không hợp lệ: thiếu tùy chỉnh thông báo chuyến đi.');
  const workspace = prepareImportedSnapshot(raw.workspace as Partial<PersistedAppState>);
  const tripIds = new Set(workspace.trips.map((item) => item.id));
  const profileIds = new Set(workspace.profiles.map((item) => item.id));
  const libraryPlaceIds = new Set(library.places.map((item) => item.id));
  if (workspace.savedPlaces.some((item) => item.sourceNotebookPlaceId && !libraryPlaceIds.has(item.sourceNotebookPlaceId))) throw new Error('Backup không hợp lệ: địa điểm chuyến đi tham chiếu Thư viện không tồn tại.');
  const tripNotificationPreferences = raw.tripNotificationPreferences as TripNotificationPreferences[];
  if (tripNotificationPreferences.some((item) => !item || typeof item.tripId !== 'string' || typeof item.userId !== 'string' || typeof item.useDefaults !== 'boolean' || !tripIds.has(item.tripId) || !profileIds.has(item.userId) || (item.enabled !== undefined && typeof item.enabled !== 'boolean') || (item.activityLeadMinutes !== undefined && !isIntegerInRange(item.activityLeadMinutes, 1, 10080)) || (item.tripStartLeadMinutes !== undefined && !isIntegerInRange(item.tripStartLeadMinutes, 1, 20160)) || (item.updatedAt !== undefined && !isValidDateTime(item.updatedAt)))) throw new Error('Backup không hợp lệ: tùy chỉnh thông báo tham chiếu hoặc giá trị không hợp lệ.');
  if (new Set(tripNotificationPreferences.map((item) => `${item.tripId}:${item.userId}`)).size !== tripNotificationPreferences.length) throw new Error('Backup không hợp lệ: tùy chỉnh thông báo chuyến đi bị trùng.');
  return {
    workspace,
    library,
    preferences,
    tripNotificationPreferences,
  };
}
