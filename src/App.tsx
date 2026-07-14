import { Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext';
import { SettingsProvider } from './context/SettingsContext';
import { NotebookProvider } from './context/NotebookContext';
import { CollaborationProvider } from './context/CollaborationContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTripReminders } from './hooks/useTripReminders';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { TripSectionTabs } from './components/TripSectionTabs';

const Login = lazyWithRetry(() => import('./screens/Login').then((module) => ({ default: module.Login })));
const ResetPassword = lazyWithRetry(() => import('./screens/ResetPassword').then((module) => ({ default: module.ResetPassword })));
const MyTrips = lazyWithRetry(() => import('./screens/MyTrips').then((module) => ({ default: module.MyTrips })));
const TripSchedule = lazyWithRetry(() => import('./screens/TripSchedule').then((module) => ({ default: module.TripSchedule })));
const TripOverview = lazyWithRetry(() => import('./screens/TripOverview').then((module) => ({ default: module.TripOverview })));
const TripExpenses = lazyWithRetry(() => import('./screens/TripExpenses').then((module) => ({ default: module.TripExpenses })));
const TripMembers = lazyWithRetry(() => import('./screens/TripMembers').then((module) => ({ default: module.TripMembers })));
const TripPlaces = lazyWithRetry(() => import('./screens/TripPlaces').then((module) => ({ default: module.TripPlaces })));
const TripPacking = lazyWithRetry(() => import('./screens/TripPacking').then((module) => ({ default: module.TripPacking })));
const TripPhotos = lazyWithRetry(() => import('./screens/TripPhotos').then((module) => ({ default: module.TripPhotos })));
const Settings = lazyWithRetry(() => import('./screens/Settings').then((module) => ({ default: module.Settings })));
const PlacesNotebook = lazyWithRetry(() => import('./screens/PlacesNotebook').then((module) => ({ default: module.PlacesNotebook })));
const GlobalPhotoLibrary = lazyWithRetry(() => import('./screens/GlobalPhotoLibrary').then((module) => ({ default: module.GlobalPhotoLibrary })));
const Inbox = lazyWithRetry(() => import('./screens/Inbox').then((module) => ({ default: module.Inbox })));
const TripMore = lazyWithRetry(() => import('./screens/TripMore').then((module) => ({ default: module.TripMore })));
const TripSettings = lazyWithRetry(() => import('./screens/TripSettings').then((module) => ({ default: module.TripSettings })));
const TripCollaboration = lazyWithRetry(() => import('./screens/TripCollaboration').then((module) => ({ default: module.TripCollaboration })));
const SyncCenter = lazyWithRetry(() => import('./screens/SyncCenter').then((module) => ({ default: module.SyncCenter })));
const PublicTripShare = lazyWithRetry(() => import('./screens/PublicTripShare').then((module) => ({ default: module.PublicTripShare })));

function TripPlanRoute() {
  return <TripSectionTabs tabs={[{ value: 'itinerary', label: 'Lịch trình' }, { value: 'places', label: 'Địa điểm' }]} fallback="itinerary">
    {(tab) => tab === 'places' ? <TripPlaces /> : <TripSchedule />}
  </TripSectionTabs>;
}

function TripPrepareRoute() {
  return <TripSectionTabs tabs={[{ value: 'packing', label: 'Checklist' }, { value: 'team', label: 'Nhóm' }]} fallback="packing">
    {(tab) => tab === 'team' ? <TripMembers /> : <TripPacking />}
  </TripSectionTabs>;
}

function LegacyTripRedirect({ path }: { path: string }) {
  const { id } = useParams();
  const location = useLocation();
  const [pathname, targetSearch = ''] = path.split('?');
  const searchParams = new URLSearchParams(location.search);
  new URLSearchParams(targetSearch).forEach((value, key) => searchParams.set(key, value));
  const search = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return <Navigate to={`/trips/${id}${pathname}${search}${location.hash}`} replace />;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md text-center">
        <p className="mb-3 font-label text-xs uppercase tracking-[0.2em] text-secondary">Bunbietbay Trips</p>
        <h1 className="mb-3 font-headline text-3xl font-bold text-primary">Đang mở màn hình</h1>
        <p className="text-secondary">Ứng dụng đang tải dữ liệu và giao diện cần thiết cho trang bạn vừa chọn.</p>
      </div>
    </div>
  );
}

function BootLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md text-center">
        <p className="mb-3 font-label text-xs uppercase tracking-[0.2em] text-secondary">Workspace</p>
        <h1 className="mb-3 font-headline text-3xl font-bold text-primary">Đang khởi tạo dữ liệu</h1>
        <p className="text-secondary">Ứng dụng đang tải tài khoản, chuyến đi, thành viên và quyền truy cập.</p>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { requiresAuth, session, isAuthLoading } = useAuth();
  const { isHydrated, workspaceStatus } = useAppContext();

  if (isAuthLoading || !isHydrated || workspaceStatus === 'hydrating' || workspaceStatus === 'loading-remote') {
    return <BootLoadingFallback />;
  }

  if (requiresAuth && !session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <GlobalExperienceEffects />
      <CommandPalette />
      <Outlet />
    </>
  );
}

function PublicLoginRoute() {
  const { isConfigured, session, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <BootLoadingFallback />;
  }

  if (!isConfigured) {
    return <Navigate to="/trips" replace />;
  }

  if (session) {
    return <Navigate to="/trips" replace />;
  }

  return <Login />;
}

function PublicAuthCallbackRoute() {
  const { isConfigured, session, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <BootLoadingFallback />;
  }

  if (!isConfigured) {
    return <Navigate to="/trips" replace />;
  }

  if (session) {
    return <Navigate to="/trips" replace />;
  }

  const queryParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-6 py-10 text-on-surface">
      <section className="w-full max-w-md rounded-[2rem] border-2 border-[#0b1213] bg-surface-container-lowest p-7 shadow-[4px_4px_0_rgba(11,18,19,0.14)] dark:border-[#fff4e6] sm:p-8">
        <p className="font-label text-xs font-bold uppercase tracking-[0.3em] text-secondary dark:text-gray-300">Bunbietbay Trips</p>
        <h1 className="mt-3 font-headline text-3xl font-black tracking-[-0.03em]">Liên kết không còn hiệu lực</h1>
        <p className="mt-4 text-on-surface-variant">
          {errorDescription || 'Không thể xác nhận liên kết email này. Liên kết có thể đã hết hạn hoặc đã được sử dụng.'}
        </p>
        <Link to="/login" className="density-button mt-6 flex w-full items-center justify-center rounded-2xl bg-slate-950 font-headline text-lg font-bold text-white transition hover:opacity-95">
          Quay lại đăng nhập
        </Link>
      </section>
    </main>
  );
}

function GlobalLayoutWrapper() {
  return (
    <Layout>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function GlobalSettingsLayoutWrapper() {
  return (
    <Layout>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function TripLayoutWrapper() {
  const { id } = useParams();

  return (
    <Layout tripId={id}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<BootLoadingFallback />}><PublicLoginRoute /></Suspense>} />
      <Route path="/auth/callback" element={<PublicAuthCallbackRoute />} />
      <Route path="/reset-password" element={<Suspense fallback={<BootLoadingFallback />}><ResetPassword /></Suspense>} />
      <Route path="/share/:token" element={<Suspense fallback={<BootLoadingFallback />}><PublicTripShare /></Suspense>} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Navigate to="/trips" replace />} />

        <Route element={<GlobalLayoutWrapper />}>
          <Route path="/trips" element={<MyTrips />} />
          <Route path="/library" element={<PlacesNotebook />} />
          <Route path="/photos" element={<GlobalPhotoLibrary />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/notebook" element={<LegacyRedirect to="/library" />} />
        </Route>

        <Route element={<GlobalSettingsLayoutWrapper />}>
          <Route path="/account" element={<Navigate to="/account/profile" replace />} />
          <Route path="/account/:section" element={<Settings />} />
          <Route path="/account/sync" element={<SyncCenter />} />
          <Route path="/settings" element={<LegacyRedirect to="/account/profile" />} />
        </Route>

        <Route path="/trips/:id" element={<TripLayoutWrapper />}>
          <Route index element={<TripOverview />} />
          <Route path="plan" element={<TripPlanRoute />} />
          <Route path="money" element={<TripExpenses />} />
          <Route path="prepare" element={<TripPrepareRoute />} />
          <Route path="memories" element={<TripPhotos />} />
          <Route path="collaborate" element={<TripCollaboration />} />
          <Route path="more" element={<TripMore />} />
          <Route path="settings" element={<TripSettings />} />
          <Route path="overview" element={<LegacyTripRedirect path="" />} />
          <Route path="schedule" element={<LegacyTripRedirect path="/plan?tab=itinerary" />} />
          <Route path="expenses" element={<LegacyTripRedirect path="/money" />} />
          <Route path="members" element={<LegacyTripRedirect path="/prepare?tab=team" />} />
          <Route path="places" element={<LegacyTripRedirect path="/plan?tab=places" />} />
          <Route path="packing" element={<LegacyTripRedirect path="/prepare?tab=packing" />} />
          <Route path="photos" element={<LegacyTripRedirect path="/memories" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}

function PasswordRecoveryGate() {
  const { isAuthLoading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <BootLoadingFallback />;
  }

  if (isPasswordRecovery && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return <AppRoutes />;
}

function GlobalExperienceEffects() {
  useKeyboardShortcuts();
  useTripReminders();
  const { showToast } = useFeedback();

  useEffect(() => {
    const handleNewInvitation = () => {
      showToast({
        tone: 'success',
        title: 'Lời mời mới',
        message: 'Bạn vừa được mời vào một chuyến đi mới. Mở Hộp thư để phản hồi.',
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };
    window.addEventListener('new_trip_invitation_event', handleNewInvitation);
    return () => window.removeEventListener('new_trip_invitation_event', handleNewInvitation);
  }, [showToast]);

  useEffect(() => {
    const handleNewNotebookInvitation = () => {
      showToast({
        tone: 'success',
        title: 'Lời mời Thư viện mới',
        message: 'Bạn vừa được mời vào một Thư viện mới. Mở Hộp thư để phản hồi.',
      });
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };
    window.addEventListener('new_notebook_invitation_event', handleNewNotebookInvitation);
    return () => window.removeEventListener('new_notebook_invitation_event', handleNewNotebookInvitation);
  }, [showToast]);

  return null;
}

function AppShell() {
  const Router = import.meta.env.VITE_USE_HASH_ROUTER === 'true' || window.desktopApi?.isDesktopApp
    ? HashRouter
    : BrowserRouter;

  return (
    <Router>
      <PasswordRecoveryGate />
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppProvider>
              <CollaborationProvider>
                <NotebookProvider>
                  <AppShell />
                </NotebookProvider>
              </CollaborationProvider>
            </AppProvider>
          </SettingsProvider>
        </AuthProvider>
      </FeedbackProvider>
    </ErrorBoundary>
  );
}
