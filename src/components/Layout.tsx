import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '../context/SettingsContext';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useNotebook } from '../context/NotebookContext';

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
      aria-label={`Giao diện: ${themeMode === 'system' ? 'Hệ thống' : themeMode === 'dark' ? 'Tối' : 'Sáng'}`}
      className="flex size-10 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors hover:bg-surface-container dark:text-white md:size-11"
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
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-outline-variant/40 bg-surface md:left-20 lg:hidden">
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
                {session ? 'Không gian có phân quyền' : requiresAuth ? 'Đăng nhập để tiếp tục' : 'Sẵn sàng trên thiết bị'}
              </span>
            </div>
          </Link>
          {!hideNavLinks && (
            <nav className="hidden items-center gap-6">
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
                to="/library"
                className={cn(
                  'font-headline text-sm font-semibold transition-colors flex items-center gap-2',
                  location.pathname.startsWith('/library') ? 'text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-primary dark:text-white',
                )}
              >
                <Icons.MapPin className="w-4 h-4" />
                Thư viện
              </Link>
              <Link
                to="/account"
                className={cn(
                  'font-headline text-sm font-semibold transition-colors',
                  location.pathname.startsWith('/account') ? 'text-on-surface' : 'text-secondary dark:text-gray-300 hover:text-primary dark:text-white',
                )}
              >
                {language === 'vi' ? 'Tài khoản' : 'Account'}
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
                aria-label={isPrivacyMode ? 'Hiện số tiền' : 'Ẩn số tiền'}
                className="flex size-10 items-center justify-center rounded-xl bg-surface-container-low text-primary transition-colors hover:bg-surface-container dark:text-white md:size-11"
                title={isPrivacyMode ? 'Hiện số tiền' : 'Ẩn số tiền'}
              >
                {isPrivacyMode ? <Icons.EyeOff className="h-5 w-5" /> : <Icons.Eye className="h-5 w-5" />}
              </button>
              <Link to="/inbox" aria-label={`Hộp thư${pendingAccessCount ? `, ${pendingAccessCount} lời mời mới` : ''}`} className="relative flex size-10 items-center justify-center rounded-xl bg-surface-container-low text-primary hover:bg-surface-container md:size-11">
                <Icons.Bell className="size-5" />
                {pendingAccessCount > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-on-error">{pendingAccessCount}</span>}
              </Link>
              <Link to="/account" className="group flex items-center gap-3 rounded-full bg-surface-container-low p-1 hover:bg-surface-container md:pr-4">
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
  const activePath = location.pathname;

  const navItems = [
    { path: `/trips/${tripId}`, icon: Icons.LayoutDashboard, label: 'Trang chủ' },
    { path: `/trips/${tripId}/plan`, icon: Icons.Calendar, label: 'Kế hoạch' },
    { path: `/trips/${tripId}/money`, icon: Icons.Banknote, label: 'Chi tiêu' },
    { path: `/trips/${tripId}/prepare`, icon: Icons.Package, label: 'Chuẩn bị' },
    { path: `/trips/${tripId}/more`, icon: Icons.Menu, label: 'Thêm' },
  ];

  return (
    <nav aria-label="Điều hướng chuyến đi" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-outline-variant/50 bg-surface px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden">
      {navItems.map((item) => {
        const isActive = item.path === `/trips/${tripId}`
          ? activePath === item.path
          : item.path.endsWith('/more')
            ? activePath.startsWith(item.path) || activePath.startsWith(`/trips/${tripId}/memories`) || activePath.startsWith(`/trips/${tripId}/settings`)
            : activePath.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center transition-colors',
              isActive
                ? 'text-primary'
                : 'text-secondary hover:text-on-surface',
            )}
          >
            <Icon className="mb-1 size-5" />
            <span className="truncate text-[10px] font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function GlobalBottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/trips', icon: Icons.Compass, label: 'Chuyến đi' },
    { path: '/library', icon: Icons.MapPin, label: 'Thư viện' },
    { path: '/inbox', icon: Icons.Mail, label: 'Hộp thư' },
    { path: '/account', icon: Icons.Settings, label: 'Tài khoản' },
  ];

  return (
    <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-outline-variant/50 bg-surface px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-colors',
              isActive
                ? 'text-primary'
                : 'text-secondary hover:text-on-surface',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="mb-1 size-5" />
            <span className="truncate text-[10px] font-semibold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TabletRail({ tripId }: { tripId?: string }) {
  const location = useLocation();
  type RailItem = { path: string; icon: typeof Icons.Compass; label: string; exact?: boolean; aliases?: string[] };
  const globalItems: RailItem[] = tripId ? [
    { path: '/trips', icon: Icons.Compass, label: 'Chuyến đi', exact: true },
    { path: '/library', icon: Icons.MapPin, label: 'Thư viện' },
    { path: '/inbox', icon: Icons.Mail, label: 'Hộp thư' },
  ] : [
    { path: '/trips', icon: Icons.Compass, label: 'Chuyến đi' },
    { path: '/library', icon: Icons.MapPin, label: 'Thư viện' },
    { path: '/inbox', icon: Icons.Mail, label: 'Hộp thư' },
    { path: '/account', icon: Icons.Settings, label: 'Tài khoản' },
  ];
  const tripItems: RailItem[] = tripId ? [
    { path: `/trips/${tripId}`, icon: Icons.LayoutDashboard, label: 'Trang chủ', exact: true },
    { path: `/trips/${tripId}/plan`, icon: Icons.Calendar, label: 'Kế hoạch' },
    { path: `/trips/${tripId}/money`, icon: Icons.Banknote, label: 'Chi tiêu' },
    { path: `/trips/${tripId}/prepare`, icon: Icons.Package, label: 'Chuẩn bị' },
    { path: `/trips/${tripId}/more`, icon: Icons.Menu, label: 'Thêm', aliases: [`/trips/${tripId}/memories`, `/trips/${tripId}/settings`] },
  ] : [];
  const items = [...globalItems, ...tripItems];

  return <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center border-r border-outline-variant/50 bg-surface px-2 py-4 md:flex lg:hidden">
    <Link to="/trips" aria-label="Bunbietbay Trips"><img src={`${import.meta.env.BASE_URL}app-logo.svg`} alt="" className="size-11 rounded-xl" /></Link>
    <nav aria-label="Điều hướng tablet" className="mt-6 flex w-full flex-col gap-2">
      {items.map((item, index) => {
        const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path) || item.aliases?.some((path) => location.pathname.startsWith(path));
        const Icon = item.icon;
        return <div key={item.path} className={index === globalItems.length && tripItems.length ? 'mt-3 border-t border-outline-variant/50 pt-3' : ''}>
          <Link to={item.path} aria-label={item.label} title={item.label} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 w-full items-center justify-center rounded-xl', active ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-low')}><Icon className="size-5" /></Link>
        </div>;
      })}
    </nav>
  </aside>;
}

function DesktopSidebar({ tripId }: { tripId?: string }) {
  const location = useLocation();
  const { currentUserProfile, trips } = useAppContext();
  const { pendingInvitations } = useAuth();
  const { pendingNotebookInvitations } = useNotebook();
  const pendingCount = pendingInvitations.length + pendingNotebookInvitations.length;
  const trip = trips.find((item) => item.id === tripId);
  const globalItems = [
    { path: '/trips', icon: Icons.Compass, label: 'Chuyến đi', exact: true },
    { path: '/library', icon: Icons.MapPin, label: 'Thư viện địa điểm' },
    { path: '/inbox', icon: Icons.Mail, label: 'Hộp thư', count: pendingCount },
    { path: '/account', icon: Icons.Settings, label: 'Tài khoản' },
  ];
  const tripItems = tripId ? [
    { path: `/trips/${tripId}`, icon: Icons.LayoutDashboard, label: 'Trang chủ', exact: true },
    { path: `/trips/${tripId}/plan`, icon: Icons.Calendar, label: 'Kế hoạch' },
    { path: `/trips/${tripId}/money`, icon: Icons.Banknote, label: 'Chi tiêu' },
    { path: `/trips/${tripId}/prepare`, icon: Icons.Package, label: 'Chuẩn bị' },
    { path: `/trips/${tripId}/memories`, icon: Icons.Image, label: 'Kỷ niệm' },
    { path: `/trips/${tripId}/settings`, icon: Icons.Settings, label: 'Thiết lập chuyến đi' },
  ] : [];

  const renderLink = (item: { path: string; icon: typeof Icons.Compass; label: string; exact?: boolean; count?: number }) => {
    const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
    const Icon = item.icon;
    return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors', active ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-low hover:text-on-surface')}>
      <Icon className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count ? <span className="flex size-6 items-center justify-center rounded-full bg-error text-xs font-bold text-on-error">{item.count}</span> : null}
    </Link>;
  };

  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-outline-variant/50 bg-surface p-4 lg:flex">
    <Link to="/trips" className="flex items-center gap-3 px-2 py-2">
      <img src={`${import.meta.env.BASE_URL}app-logo.svg`} alt="" className="size-10 rounded-xl" />
      <span className="font-headline text-lg font-extrabold">Bunbietbay Trips</span>
    </Link>
    <nav aria-label="Điều hướng chính" className="mt-6 space-y-1">{globalItems.map(renderLink)}</nav>
    {tripItems.length > 0 && <>
      <div className="my-5 border-t border-outline-variant/50" />
      <p className="px-3 text-xs font-semibold text-secondary">{trip?.title ?? 'Chuyến đi hiện tại'}</p>
      <nav aria-label="Điều hướng chuyến đi" className="mt-2 space-y-1">{tripItems.map(renderLink)}</nav>
    </>}
    <Link to="/account/profile" className="mt-auto flex items-center gap-3 rounded-xl bg-surface-container-low p-3">
      <img src={currentUserProfile?.avatar || 'https://api.dicebear.com/9.x/glass/svg?seed=traveler'} alt="" className="size-9 rounded-full object-cover" />
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{currentUserProfile?.displayName || 'Khách'}</span><span className="block truncate text-xs text-secondary">Quản lý tài khoản</span></span>
    </Link>
  </aside>;
}

export function Layout({ children, hideNavLinks = false, tripId }: { children: ReactNode; hideNavLinks?: boolean; tripId?: string }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { isRemoteMode, isSyncing, retryWorkspaceSync, workspaceError, workspaceStatus } = useAppContext();
  const hasWorkspaceError = workspaceStatus === 'remote-unavailable' || workspaceStatus === 'schema-incompatible';

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
    <div className="min-h-dvh w-full overflow-x-hidden bg-surface pb-24 font-body text-on-surface md:pb-0 md:pl-20 lg:pl-72">
      {isOffline && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-error py-1.5 text-center text-xs font-bold text-on-error md:left-20 lg:left-72">
          <Icons.AlertTriangle className="w-3.5 h-3.5" /> {isRemoteMode ? 'Đang ngoại tuyến. Dữ liệu cloud tạm thời chỉ đọc.' : 'Đang ngoại tuyến. Dữ liệu sẽ lưu trên máy.'}
        </div>
      )}
      <DesktopSidebar tripId={tripId} />
      <TabletRail tripId={tripId} />
      <div className={isOffline ? "pt-7" : ""}>
        <TopNav hideNavLinks={hideNavLinks} />
      </div>
      <main id="main-content" className={`mx-auto max-w-[92rem] px-4 md:px-6 lg:px-8 ${isOffline ? 'pt-[7.25rem] lg:pt-12' : 'pt-24 lg:pt-8'}`}>
        {hasWorkspaceError && workspaceError && (
          <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Icons.AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-headline font-bold">Không thể tải dữ liệu cloud</p>
                <p className="mt-1 text-sm">{workspaceError.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void retryWorkspaceSync()}
              disabled={isSyncing}
              className="shrink-0 rounded-xl bg-amber-900 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950"
            >
              {isSyncing ? 'Đang thử lại…' : 'Thử lại'}
            </button>
          </div>
        )}
        {children}
      </main>
      {tripId ? <BottomNav tripId={tripId} /> : !hideNavLinks && <GlobalBottomNav />}
    </div>
  );
}
