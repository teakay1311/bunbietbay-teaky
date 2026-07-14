import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AppBackgroundPreference, TripNotificationPreferences, UserPreferences } from '../domain/models';
import { resolveTripReminders } from '../domain/notificationPreferences';
import { mapRemoteTripPreferences, mapRemoteUserPreferences, normalizeAppBackgroundPreference, readStoredAppBackground, readStoredTripPreferences, toRemoteTripPreferences, toRemoteUserPreferences } from '../data/preferencesService';

type ThemeMode = 'light' | 'dark' | 'system';
type Language = 'vi' | 'en';
type UiDensity = 'cozy' | 'compact';

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  secondary: string;
  secondaryContainer: string;
  tertiary: string;
  surfaceTint: string;
  primaryFixed: string;
  primaryFixedDim: string;
  inversePrimary: string;
};

interface SettingsContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  themePresetId: string;
  setThemePresetId: (presetId: string) => void;
  themePresets: ThemePreset[];
  uiDensity: UiDensity;
  setUiDensity: (density: UiDensity) => void;
  appBackground: AppBackgroundPreference;
  setAppBackground: (background: AppBackgroundPreference) => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  reminderLeadMinutes: number;
  setReminderLeadMinutes: (minutes: number) => void;
  tripStartLeadMinutes: number;
  setTripStartLeadMinutes: (minutes: number) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (enabled: boolean) => void;
  tripNotificationPreferences: Record<string, TripNotificationPreferences>;
  getEffectiveTripReminders: (tripId: string) => { enabled: boolean; activityLeadMinutes: number; tripStartLeadMinutes: number; usesDefaults: boolean };
  setTripNotificationPreferences: (tripId: string, preferences: Omit<TripNotificationPreferences, 'tripId' | 'userId' | 'updatedAt'>) => Promise<void>;
  resetTripNotificationPreferences: (tripId: string) => Promise<void>;
  replaceLocalTripNotificationPreferences: (preferences: TripNotificationPreferences[]) => void;
  isPreferencesSyncing: boolean;
  preferencesSyncError: string | null;
  preferences: UserPreferences;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'teal-editorial',
    name: 'Xanh biển trầm',
    primary: '#00515f',
    primaryContainer: '#006b7d',
    onPrimary: '#ffffff',
    secondary: '#4d616c',
    secondaryContainer: '#d0e6f3',
    tertiary: '#005449',
    surfaceTint: '#006879',
    primaryFixed: '#aaedff',
    primaryFixedDim: '#84d2e6',
    inversePrimary: '#84d2e6',
  },
  {
    id: 'sunburst',
    name: 'Vàng Tươi',
    primary: '#f59e0b',
    primaryContainer: '#fbbf24',
    onPrimary: '#1f1300',
    secondary: '#9a6700',
    secondaryContainer: '#ffecb8',
    tertiary: '#d97706',
    surfaceTint: '#f59e0b',
    primaryFixed: '#fde68a',
    primaryFixedDim: '#fcd34d',
    inversePrimary: '#fcd34d',
  },
  {
    id: 'lime-punch',
    name: 'Xanh Lá Tươi',
    primary: '#22c55e',
    primaryContainer: '#4ade80',
    onPrimary: '#03210d',
    secondary: '#15803d',
    secondaryContainer: '#dcfce7',
    tertiary: '#16a34a',
    surfaceTint: '#22c55e',
    primaryFixed: '#bbf7d0',
    primaryFixedDim: '#86efac',
    inversePrimary: '#86efac',
  },
  {
    id: 'ocean-pop',
    name: 'Xanh Biển Tươi',
    primary: '#0ea5e9',
    primaryContainer: '#38bdf8',
    onPrimary: '#031b2a',
    secondary: '#0284c7',
    secondaryContainer: '#dbeafe',
    tertiary: '#06b6d4',
    surfaceTint: '#0ea5e9',
    primaryFixed: '#bae6fd',
    primaryFixedDim: '#7dd3fc',
    inversePrimary: '#7dd3fc',
  },
  {
    id: 'mint-fizz',
    name: 'Xanh Ngọc Sáng',
    primary: '#14b8a6',
    primaryContainer: '#2dd4bf',
    onPrimary: '#03211d',
    secondary: '#0f766e',
    secondaryContainer: '#ccfbf1',
    tertiary: '#06b6d4',
    surfaceTint: '#14b8a6',
    primaryFixed: '#99f6e4',
    primaryFixedDim: '#5eead4',
    inversePrimary: '#5eead4',
  },
  {
    id: 'coral-energy',
    name: 'Cam Sáng',
    primary: '#f97316',
    primaryContainer: '#fb923c',
    onPrimary: '#2a1000',
    secondary: '#ea580c',
    secondaryContainer: '#ffedd5',
    tertiary: '#ef4444',
    surfaceTint: '#f97316',
    primaryFixed: '#fdba74',
    primaryFixedDim: '#fb923c',
    inversePrimary: '#fdba74',
  },
];

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function applyTheme(mode: ThemeMode) {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');

  if (mode === 'system') {
    root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    return;
  }

  root.classList.add(mode);
}

function applyThemePreset(preset: ThemePreset) {
  const root = window.document.documentElement;
  root.style.setProperty('--color-primary', preset.primary);
  root.style.setProperty('--color-primary-container', preset.primaryContainer);
  root.style.setProperty('--color-on-primary', preset.onPrimary);
  root.style.setProperty('--color-secondary', preset.secondary);
  root.style.setProperty('--color-secondary-container', preset.secondaryContainer);
  root.style.setProperty('--color-tertiary', preset.tertiary);
  root.style.setProperty('--color-surface-tint', preset.surfaceTint);
  root.style.setProperty('--color-primary-fixed', preset.primaryFixed);
  root.style.setProperty('--color-primary-fixed-dim', preset.primaryFixedDim);
  root.style.setProperty('--color-inverse-primary', preset.inversePrimary);
  root.style.setProperty('--color-editorial-start', preset.primary);
  root.style.setProperty('--color-editorial-end', preset.primaryContainer);
}

function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }

  return Notification.permission;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session: authSession, isPasswordRecovery } = useAuth();
  const session = isPasswordRecovery ? null : authSession;
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem('themeMode') as ThemeMode || 'system');
  const [themePresetId, setThemePresetId] = useState(() => localStorage.getItem('themePresetId') || THEME_PRESETS[0].id);
  const [language, setLanguage] = useState<Language>('vi');
  const [uiDensity, setUiDensity] = useState<UiDensity>(() => localStorage.getItem('uiDensity') as UiDensity || 'cozy');
  const [appBackground, setAppBackgroundState] = useState<AppBackgroundPreference>(() => readStoredAppBackground());
  const [remindersEnabled, setRemindersEnabled] = useState(() => localStorage.getItem('remindersEnabled') !== 'false');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(() => Number(localStorage.getItem('reminderLeadMinutes') || '120'));
  const [tripStartLeadMinutes, setTripStartLeadMinutes] = useState(() => Number(localStorage.getItem('tripStartLeadMinutes') || '1440'));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => localStorage.getItem('isPrivacyMode') === 'true');
  const [tripNotificationPreferences, setTripNotificationPreferencesState] = useState<Record<string, TripNotificationPreferences>>(() => readStoredTripPreferences('bunbietbay-trip-notification-preferences:local'));
  const [isPreferencesSyncing, setIsPreferencesSyncing] = useState(false);
  const [preferencesSyncError, setPreferencesSyncError] = useState<string | null>(null);
  const didLoadRemotePreferences = useRef(false);
  const lastSyncedPreferencesRef = useRef<UserPreferences | null>(null);

  const selectedThemePreset = useMemo(
    () => THEME_PRESETS.find((preset) => preset.id === themePresetId) ?? THEME_PRESETS[0],
    [themePresetId],
  );
  const preferences = useMemo<UserPreferences>(() => ({
    themeMode,
    themePresetId: selectedThemePreset.id,
    uiDensity,
    appBackground,
    isPrivacyMode,
    remindersEnabled,
    activityLeadMinutes: reminderLeadMinutes,
    tripStartLeadMinutes,
  }), [appBackground, isPrivacyMode, reminderLeadMinutes, remindersEnabled, selectedThemePreset.id, themeMode, tripStartLeadMinutes, uiDensity]);

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    applyTheme(themeMode);

    if (themeMode !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('themePresetId', selectedThemePreset.id);
    applyThemePreset(selectedThemePreset);
  }, [selectedThemePreset]);

  useEffect(() => {
    localStorage.setItem('uiDensity', uiDensity);
    document.body.dataset.density = uiDensity;
  }, [uiDensity]);

  useEffect(() => {
    localStorage.setItem('appBackground', JSON.stringify(appBackground));
  }, [appBackground]);

  useEffect(() => {
    localStorage.setItem('remindersEnabled', String(remindersEnabled));
  }, [remindersEnabled]);

  useEffect(() => {
    localStorage.setItem('reminderLeadMinutes', String(reminderLeadMinutes));
  }, [reminderLeadMinutes]);

  useEffect(() => {
    localStorage.setItem('tripStartLeadMinutes', String(tripStartLeadMinutes));
  }, [tripStartLeadMinutes]);

  useEffect(() => {
    localStorage.setItem('isPrivacyMode', String(isPrivacyMode));
  }, [isPrivacyMode]);

  useEffect(() => {
    if (!session || !supabase || !isSupabaseConfigured) {
      didLoadRemotePreferences.current = false;
      lastSyncedPreferencesRef.current = null;
      return;
    }

    const client = supabase;
    let cancelled = false;
    didLoadRemotePreferences.current = false;
    lastSyncedPreferencesRef.current = null;
    setTripNotificationPreferencesState(readStoredTripPreferences(`bunbietbay-trip-notification-preferences:${session.user.id}`));
    setIsPreferencesSyncing(true);
    setPreferencesSyncError(null);
    void Promise.all([
      client.from('user_preferences').select('*').eq('user_id', session.user.id).maybeSingle(),
      client.from('trip_notification_preferences').select('*').eq('user_id', session.user.id),
    ]).then(([userResponse, tripResponse]) => {
      if (cancelled) return;
      if (userResponse.error || tripResponse.error) {
        const error = userResponse.error ?? tripResponse.error;
        const isSchemaError = Boolean(error && (error.message.includes('schema cache') || error.message.includes('does not exist') || error.message.includes('relation')));
        setPreferencesSyncError(isSchemaError ? 'Phiên bản cơ sở dữ liệu chưa hỗ trợ đồng bộ tùy chỉnh.' : error?.message ?? 'Không thể tải tùy chỉnh cloud.');
        return;
      }
      if (userResponse.data) {
        const remotePreferences = mapRemoteUserPreferences(userResponse.data, THEME_PRESETS[0].id);
        lastSyncedPreferencesRef.current = remotePreferences;
        setThemeMode(remotePreferences.themeMode);
        setThemePresetId(remotePreferences.themePresetId);
        setUiDensity(remotePreferences.uiDensity);
        setAppBackgroundState(remotePreferences.appBackground);
        setIsPrivacyMode(remotePreferences.isPrivacyMode);
        setRemindersEnabled(remotePreferences.remindersEnabled);
        setReminderLeadMinutes(remotePreferences.activityLeadMinutes);
        setTripStartLeadMinutes(remotePreferences.tripStartLeadMinutes);
      } else {
        void client.from('user_preferences').insert(toRemoteUserPreferences(session.user.id, preferences))
          .then(({ error }) => { if (!error) lastSyncedPreferencesRef.current = preferences; });
      }
      setTripNotificationPreferencesState(mapRemoteTripPreferences(tripResponse.data ?? []));
      didLoadRemotePreferences.current = true;
    }).finally(() => {
      if (!cancelled) setIsPreferencesSyncing(false);
    });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    const storageKey = session?.user.id
      ? `bunbietbay-trip-notification-preferences:${session.user.id}`
      : 'bunbietbay-trip-notification-preferences:local';
    localStorage.setItem(storageKey, JSON.stringify(tripNotificationPreferences));
  }, [session?.user.id, tripNotificationPreferences]);

  useEffect(() => {
    if (!session || !supabase || !didLoadRemotePreferences.current) return;
    const client = supabase;
    const payload = toRemoteUserPreferences(session.user.id, { ...preferences, updatedAt: new Date().toISOString() });
    const timeout = window.setTimeout(() => {
      setIsPreferencesSyncing(true);
      void (async () => {
        try {
          const { error } = await client.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
          if (error) {
            setPreferencesSyncError(error.message);
            const previous = lastSyncedPreferencesRef.current;
            if (previous) {
              setThemeMode(previous.themeMode);
              setThemePresetId(previous.themePresetId);
              setUiDensity(previous.uiDensity);
              setAppBackgroundState(previous.appBackground);
              setIsPrivacyMode(previous.isPrivacyMode);
              setRemindersEnabled(previous.remindersEnabled);
              setReminderLeadMinutes(previous.activityLeadMinutes);
              setTripStartLeadMinutes(previous.tripStartLeadMinutes);
            }
          } else {
            lastSyncedPreferencesRef.current = preferences;
            setPreferencesSyncError(null);
          }
        } finally {
          setIsPreferencesSyncing(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [appBackground, isPrivacyMode, preferences, reminderLeadMinutes, remindersEnabled, selectedThemePreset.id, session, themeMode, tripStartLeadMinutes, uiDensity]);

  const setAppBackground = useCallback(async (nextBackground: AppBackgroundPreference) => {
    const normalized = normalizeAppBackgroundPreference(nextBackground);
    const nextPreferences: UserPreferences = { ...preferences, appBackground: normalized, updatedAt: new Date().toISOString() };
    if (session && supabase && didLoadRemotePreferences.current) {
      setIsPreferencesSyncing(true);
      try {
        const { error } = await supabase.from('user_preferences').upsert(toRemoteUserPreferences(session.user.id, nextPreferences), { onConflict: 'user_id' });
        if (error) throw error;
        lastSyncedPreferencesRef.current = nextPreferences;
        setPreferencesSyncError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể lưu ảnh nền.';
        setPreferencesSyncError(message);
        throw error;
      } finally {
        setIsPreferencesSyncing(false);
      }
    }
    setAppBackgroundState(normalized);
  }, [preferences, session]);

  const getEffectiveTripReminders = useCallback((tripId: string) => {
    return resolveTripReminders({ enabled: remindersEnabled, activityLeadMinutes: reminderLeadMinutes, tripStartLeadMinutes }, tripNotificationPreferences[tripId]);
  }, [reminderLeadMinutes, remindersEnabled, tripNotificationPreferences, tripStartLeadMinutes]);

  const setTripNotificationPreferences = useCallback(async (tripId: string, preferences: Omit<TripNotificationPreferences, 'tripId' | 'userId' | 'updatedAt'>) => {
    const userId = session?.user.id ?? 'local';
    const previous = tripNotificationPreferences[tripId];
    const next: TripNotificationPreferences = { tripId, userId, ...preferences, updatedAt: new Date().toISOString() };
    setTripNotificationPreferencesState((current) => ({ ...current, [tripId]: next }));
    if (!session || !supabase) return;
    const { error } = await supabase.from('trip_notification_preferences').upsert(toRemoteTripPreferences(next), { onConflict: 'trip_id,user_id' });
    if (error) {
      setTripNotificationPreferencesState((current) => {
        const restored = { ...current };
        if (previous) restored[tripId] = previous;
        else delete restored[tripId];
        return restored;
      });
      throw error;
    }
  }, [session, tripNotificationPreferences]);

  const resetTripNotificationPreferences = useCallback(async (tripId: string) => {
    await setTripNotificationPreferences(tripId, { useDefaults: true });
  }, [setTripNotificationPreferences]);

  const replaceLocalTripNotificationPreferences = useCallback((nextPreferences: TripNotificationPreferences[]) => {
    if (session) throw new Error('Chỉ có thể thay toàn bộ tùy chỉnh thông báo trong workspace local.');
    setTripNotificationPreferencesState(Object.fromEntries(nextPreferences.map((item) => [item.tripId, item])));
  }, [session]);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const value = useMemo<SettingsContextType>(() => ({
    themeMode,
    setThemeMode,
    primaryColor: selectedThemePreset.primary,
    setPrimaryColor: (color: string) => {
      const nextPreset = THEME_PRESETS.find((preset) => preset.primary === color);
      if (nextPreset) {
        setThemePresetId(nextPreset.id);
      }
    },
    themePresetId: selectedThemePreset.id,
    setThemePresetId,
    themePresets: THEME_PRESETS,
    uiDensity,
    setUiDensity,
    appBackground,
    setAppBackground,
    language,
    setLanguage,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadMinutes,
    setReminderLeadMinutes,
    tripStartLeadMinutes,
    setTripStartLeadMinutes,
    notificationPermission,
    requestNotificationPermission,
    isPrivacyMode,
    setIsPrivacyMode,
    tripNotificationPreferences,
    getEffectiveTripReminders,
    setTripNotificationPreferences,
    resetTripNotificationPreferences,
    replaceLocalTripNotificationPreferences,
    isPreferencesSyncing,
    preferencesSyncError,
    preferences,
  }), [appBackground, getEffectiveTripReminders, isPreferencesSyncing, isPrivacyMode, language, notificationPermission, preferences, preferencesSyncError, reminderLeadMinutes, remindersEnabled, replaceLocalTripNotificationPreferences, requestNotificationPermission, resetTripNotificationPreferences, selectedThemePreset.id, selectedThemePreset.primary, setAppBackground, setTripNotificationPreferences, themeMode, tripNotificationPreferences, tripStartLeadMinutes, uiDensity]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }

  return context;
}

export function useFormatMoney() {
  const { isPrivacyMode } = useSettings();

  const formatMoney = useCallback((amount: number | string, symbol: string = '') => {
    if (isPrivacyMode) {
      if (typeof amount === 'string' && amount.startsWith('+')) return `+***${symbol}`;
      if (typeof amount === 'string' && amount.startsWith('-')) return `-***${symbol}`;
      return `***${symbol}`;
    }
    const num = typeof amount === 'number' ? amount : Number(amount);
    return `${num.toLocaleString('vi-VN')}${symbol}`;
  }, [isPrivacyMode]);

  return formatMoney;
}
