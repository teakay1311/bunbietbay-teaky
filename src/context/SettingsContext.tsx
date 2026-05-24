import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
  language: Language;
  setLanguage: (lang: Language) => void;
  remindersEnabled: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  reminderLeadMinutes: number;
  setReminderLeadMinutes: (minutes: number) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  isPrivacyMode: boolean;
  setIsPrivacyMode: (enabled: boolean) => void;
  autoAcceptTripInvites: boolean;
  setAutoAcceptTripInvites: (enabled: boolean) => void;
  autoAcceptNotebookInvites: boolean;
  setAutoAcceptNotebookInvites: (enabled: boolean) => void;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'teal-editorial',
    name: 'Teal Editorial',
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
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem('themeMode') as ThemeMode || 'system');
  const [themePresetId, setThemePresetId] = useState(() => localStorage.getItem('themePresetId') || THEME_PRESETS[0].id);
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('language') as Language || 'vi');
  const [uiDensity, setUiDensity] = useState<UiDensity>(() => localStorage.getItem('uiDensity') as UiDensity || 'cozy');
  const [remindersEnabled, setRemindersEnabled] = useState(() => localStorage.getItem('remindersEnabled') !== 'false');
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(() => Number(localStorage.getItem('reminderLeadMinutes') || '120'));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => localStorage.getItem('isPrivacyMode') === 'true');
  const [autoAcceptTripInvites, setAutoAcceptTripInvites] = useState(() => localStorage.getItem('autoAcceptTripInvites') !== 'false');
  const [autoAcceptNotebookInvites, setAutoAcceptNotebookInvites] = useState(() => localStorage.getItem('autoAcceptNotebookInvites') !== 'false');

  const selectedThemePreset = useMemo(
    () => THEME_PRESETS.find((preset) => preset.id === themePresetId) ?? THEME_PRESETS[0],
    [themePresetId],
  );

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
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('remindersEnabled', String(remindersEnabled));
  }, [remindersEnabled]);

  useEffect(() => {
    localStorage.setItem('reminderLeadMinutes', String(reminderLeadMinutes));
  }, [reminderLeadMinutes]);

  useEffect(() => {
    localStorage.setItem('isPrivacyMode', String(isPrivacyMode));
  }, [isPrivacyMode]);

  useEffect(() => {
    localStorage.setItem('autoAcceptTripInvites', String(autoAcceptTripInvites));
  }, [autoAcceptTripInvites]);

  useEffect(() => {
    localStorage.setItem('autoAcceptNotebookInvites', String(autoAcceptNotebookInvites));
  }, [autoAcceptNotebookInvites]);

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
    language,
    setLanguage,
    remindersEnabled,
    setRemindersEnabled,
    reminderLeadMinutes,
    setReminderLeadMinutes,
    notificationPermission,
    requestNotificationPermission,
    isPrivacyMode,
    setIsPrivacyMode,
    autoAcceptTripInvites,
    setAutoAcceptTripInvites,
    autoAcceptNotebookInvites,
    setAutoAcceptNotebookInvites,
  }), [language, notificationPermission, reminderLeadMinutes, remindersEnabled, requestNotificationPermission, selectedThemePreset.id, selectedThemePreset.primary, themeMode, uiDensity, isPrivacyMode, autoAcceptTripInvites, autoAcceptNotebookInvites]);

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
