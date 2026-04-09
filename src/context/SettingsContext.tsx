import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type Language = 'vi' | 'en';

interface SettingsContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => localStorage.getItem('themeMode') as ThemeMode || 'system');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#00515f');
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('language') as Language || 'vi');

  const applyTheme = (mode: ThemeMode) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (mode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(mode);
  };

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
    localStorage.setItem('primaryColor', primaryColor);
    const root = window.document.documentElement;
    root.style.setProperty('--color-primary', primaryColor);
    // Rough approximations for variants based on primary
    root.style.setProperty('--color-primary-container', primaryColor + 'cc');
    root.style.setProperty('--color-on-primary', '#ffffff');
  }, [primaryColor]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  return (
    <SettingsContext.Provider value={{ themeMode, setThemeMode, primaryColor, setPrimaryColor, language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
