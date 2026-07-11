import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '../context/SettingsContext';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNotebook } from '../context/NotebookContext';
import { motion, AnimatePresence } from 'motion/react';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function ThemeToggleButton() {
  const { themeMode, setThemeMode } = useSettings();

  const handleToggle = () => {
    if (themeMode === 'light') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('system');
    else setThemeMode('light');
  };

  const Icon = themeMode === 'system' ? Icons.Laptop : themeMode === 'dark' ? Icons.Moon : Icons.Sun;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-all hover:scale-105 hover:bg-surface-container hover:shadow-md active:scale-95 dark:text-white md:h-11 md:w-11 md:rounded-2xl"
      title={`Giao diện: ${themeMode === 'system' ? 'Hệ thống' : themeMode === 'dark' ? 'Tối' : 'Sáng'}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function TopNav({ hideNavLinks = false }: { hideNavLinks?: boolean }) {
  const { language, isPrivacyMode, setIsPrivacyMode } = useSettings();
  const { currentUserProfile } = useAppContext();
  const { session, requiresAuth, pendingInvitations } = useAuth();
  const { pendingNotebookInvitations } = useNotebook();
  const location = useLocation();
  const navigate = useNavigate();
  const logoSrc = `${import.meta.env.BASE_URL}app-logo.svg`;
  const isTripsHome = location.pathname === '/' || location.pathname === '/trips';
  const shouldShowBackButton = !isTripsHome;
  const pendingAccessCount = pendingInvitations.length + pendingNotebookInvitations.length;

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/trips');
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 dark:border-white/5 bg-surface/80 backdrop-blur-2xl shadow-[0_4px_32px_-12px_rgba(0,0,0,0.1)]">
      <div className="mx-auto flex w-full max-w-[92rem] items-center justify-between gap-2 px-3 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-6">
          {shouldShowBackButton && (
            <button
              type="button"
              onClick={handleGoBack}
              aria-label={language === 'vi' ? 'Quay lại' : 'Go back'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface-container-low text-primary transition-all hover:scale-105 hover:bg-surface-container hover:shadow-md active:scale-95 dark:text-white md:h-11 md:w-11 md:rounded-2xl"
            >
              <Icons.ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <Link to="/trips" className="group flex min-w-0 flex-1 items-center gap-2 transition-transform active:scale-95 md:gap-3">
            <img src={logoSrc} alt="Bunbietbay Trips" className="h-10 w-10 shrink-0 rounded-xl shadow-sm transition-transform group-hover:scale-105 md:h-11 md:w-11 md:rounded-2xl" />
            <div className="min-w-0">
              <span className="block truncate font-headline text-lg font-black text-on-surface md:text-2xl">
                Bunbietbay Trips
              </span>
              <span className="hidden truncate font-label text-[11px] uppercase tracking-[0.2em] text-secondary dark:text-gray-300 sm:block">
                {session ? 'Workspace có phân quyền' : requiresAuth ? 'Đăng nhập để vào workspace' : 'Local + cloud ready'}
              </span>
            </div>
          </Link>
          {!hideNavLinks && (
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                to="/trips"
                className={cn(
                  'font-headline text-sm font-semibold transition-colors',
                  location.pathname.startsWith('/trips') ? 'text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-primary dark:text-white',
                )}
              >
                {language === 'vi' ? 'Chuyến đi' : 'Trips'}
              </Link>
              <Link
                to="/notebook"
                className={cn(
                  'font-headline text-sm font-semibold transition-colors flex items-center gap-2',
                  location.pathname.startsWith('/notebook') ? 'text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-primary dark:text-white',
                )}
              >
                <Icons.MapPin className="w-4 h-4" />
                Sổ tay
              </Link>
              <Link
                to="/settings"
                className={cn(
                  'font-headline text-sm font-semibold transition-colors',
                  location.pathname.startsWith('/settings') ? 'text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-primary dark:text-white',
                )}
              >
                {language === 'vi' ? 'Cài đặt' : 'Settings'}
              </Link>
            </nav>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
          {!session && requiresAuth ? (
            <Link
              to="/login"
              className="rounded-2xl bg-slate-950 px-4 py-2.5 font-headline text-sm font-bold text-white transition hover:opacity-95"
            >
              Đăng nhập
            </Link>
          ) : (
            <>
              <ThemeToggleButton />
              <button
                type="button"
                onClick={() => setIsPrivacyMode(!isPrivacyMode)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-all hover:scale-105 hover:bg-surface-container hover:shadow-md active:scale-95 dark:text-white md:h-11 md:w-11 md:rounded-2xl"
                title={isPrivacyMode ? 'Hiện số tiền' : 'Ẩn số tiền'}
              >
                {isPrivacyMode ? <Icons.EyeOff className="h-5 w-5" /> : <Icons.Eye className="h-5 w-5" />}
              </button>
              <Link
                to="/settings"
                className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-low text-primary transition-all hover:scale-105 hover:bg-surface-container hover:shadow-md active:scale-95 dark:text-white sm:flex"
                title="Cài đặt"
              >
                <Icons.Settings className="h-5 w-5" />
              </Link>
              <Link to="/settings" className="group flex items-center gap-3 rounded-full bg-surface-container-low p-1 shadow-sm transition-all hover:bg-surface-container active:scale-95 md:pr-4">
                <div className="relative h-9 w-9 md:h-10 md:w-10">
                  <div className="h-full w-full overflow-hidden rounded-full border-2 border-primary-container">
                    <img
                      alt={currentUserProfile?.displayName || 'User profile avatar'}
                      className="h-full w-full object-cover"
                      src={currentUserProfile?.avatar || 'https://api.dicebear.com/9.x/glass/svg?seed=traveler'}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  {pendingAccessCount > 0 && (
                    <div className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                      {pendingAccessCount}
                    </div>
                  )}
                </div>
                <div className="hidden text-left md:block">
                  <p className="font-headline text-sm font-bold text-on-surface">{currentUserProfile?.displayName || 'Khách'}</p>
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary dark:text-gray-300">
                    {session ? 'Đã kết nối tài khoản' : 'Chế độ local'}
                  </p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ tripId }: { tripId: string }) {
  const location = useLocation();
  const { language } = useSettings();
  const activePath = location.pathname;

  const navItems = [
    { path: `/trips/${tripId}/overview`, icon: Icons.LayoutDashboard, label: language === 'vi' ? 'Tổng quan' : 'Overview' },
    { path: `/trips/${tripId}/schedule`, icon: Icons.Calendar, label: language === 'vi' ? 'Lịch trình' : 'Schedule' },
    { path: `/trips/${tripId}/expenses`, icon: Icons.Banknote, label: language === 'vi' ? 'Chi tiêu' : 'Expenses' },
    { path: `/trips/${tripId}/members`, icon: Icons.Users, label: language === 'vi' ? 'Thành viên' : 'Members' },
    { path: `/trips/${tripId}/places`, icon: Icons.Bookmark, label: language === 'vi' ? 'Địa điểm' : 'Places' },
    { path: `/trips/${tripId}/packing`, icon: Icons.Package, label: language === 'vi' ? 'Hành lý' : 'Packing' },
    { path: `/trips/${tripId}/photos`, icon: Icons.Image, label: language === 'vi' ? 'Thư viện' : 'Photos' },
  ];

  useEffect(() => {
    const nav = document.getElementById('bottom-nav');
    if (nav) {
      const active = nav.querySelector('[data-active="true"]');
      if (active) {
        requestAnimationFrame(() => {
          active.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
        });
      }
    }
  }, [activePath]);

  return (
    <nav id="bottom-nav" className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-start overflow-x-auto no-scrollbar rounded-t-2xl border-t border-white/10 bg-surface/90 px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2.5 shadow-[0_-18px_40px_-16px_rgba(0,0,0,0.16)] ring-1 ring-white/10 backdrop-blur-2xl dark:border-white/5 dark:ring-white/5 md:left-1/2 md:mb-6 md:max-w-3xl md:-translate-x-1/2 md:justify-around md:rounded-3xl md:border-none md:px-4 md:pb-3 md:pt-4">
      {navItems.map((item) => {
        const isActive = activePath === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            data-active={isActive ? "true" : "false"}
            className={cn(
              'group flex min-w-[64px] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-surface-container-low active:scale-90 md:min-w-[76px] md:rounded-2xl md:px-3 md:py-2',
              isActive
                ? 'bg-primary/15 text-primary dark:text-white shadow-inner'
                : 'text-outline hover:text-primary dark:text-white',
            )}
          >
            <Icon className={cn('mb-0.5 h-5 w-5 transition-transform group-hover:scale-110 md:mb-1 md:h-6 md:w-6', isActive && 'fill-current')} />
            <span className="font-label text-[9px] font-bold uppercase tracking-wide md:text-[10px] md:tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function GlobalBottomNav() {
  const location = useLocation();
  const { language } = useSettings();

  const navItems = [
    { path: '/trips', icon: Icons.Compass, label: language === 'vi' ? 'Chuyến đi' : 'Trips' },
    { path: '/notebook', icon: Icons.MapPin, label: language === 'vi' ? 'Sổ tay' : 'Notebook' },
    { path: '/settings', icon: Icons.Settings, label: language === 'vi' ? 'Cài đặt' : 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-2xl border-t border-white/10 bg-surface/90 px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2.5 shadow-[0_-18px_40px_-16px_rgba(0,0,0,0.16)] ring-1 ring-white/10 backdrop-blur-2xl dark:border-white/5 dark:ring-white/5 md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'group flex min-w-[82px] flex-col items-center justify-center rounded-xl px-3 py-1.5 transition-all duration-300 ease-out active:scale-90',
              isActive
                ? 'bg-primary/15 text-primary dark:text-white'
                : 'text-outline hover:text-primary dark:text-white',
            )}
          >
            <Icon className={cn('mb-0.5 h-5 w-5 transition-transform', isActive && 'fill-current')} />
            <span className="font-label text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children, hideNavLinks = false, tripId }: { children: ReactNode; hideNavLinks?: boolean; tripId?: string }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-surface pb-32 font-body text-on-surface md:pb-32">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[#FA4D56] text-white text-[11px] uppercase tracking-widest font-bold text-center py-1.5 flex items-center justify-center gap-2 shadow-sm">
          <Icons.AlertTriangle className="w-3.5 h-3.5" /> Đang ngoại tuyến. Dữ liệu sẽ lưu trên máy.
        </div>
      )}
      <div className={isOffline ? "pt-7" : ""}>
        <TopNav hideNavLinks={hideNavLinks} />
      </div>
      <main className={`mx-auto max-w-[92rem] px-4 md:px-6 ${isOffline ? 'pt-[7.25rem] md:pt-[8.5rem]' : 'pt-24 md:pt-28'}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ willChange: 'opacity' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {tripId ? <BottomNav tripId={tripId} /> : !hideNavLinks && <GlobalBottomNav />}
    </div>
  );
}
