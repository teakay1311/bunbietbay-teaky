import { Suspense, useEffect, type CSSProperties } from 'react';
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppProvider, useAppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext';
import { SettingsProvider } from './context/SettingsContext';
import { NotebookProvider } from './context/NotebookContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTripReminders } from './hooks/useTripReminders';
import { lazyWithRetry } from './utils/lazyWithRetry';

const Login = lazyWithRetry(() => import('./screens/Login').then((module) => ({ default: module.Login })));
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
  const { isHydrated } = useAppContext();

  if (isAuthLoading || !isHydrated) {
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
  const { requiresAuth, session, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <BootLoadingFallback />;
  }

  if (!requiresAuth) {
    return <Navigate to="/trips" replace />;
  }

  if (session) {
    return <Navigate to="/trips" replace />;
  }

  return <Login />;
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
  const { trips } = useAppContext();
  const trip = trips.find(t => t.id === id);

  return (
    <div style={trip?.themeColor ? { '--color-primary': trip.themeColor } as CSSProperties : {}} className="contents">
      <Layout tripId={id}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </Layout>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<BootLoadingFallback />}><PublicLoginRoute /></Suspense>} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Navigate to="/trips" replace />} />

        <Route element={<GlobalLayoutWrapper />}>
          <Route path="/trips" element={<MyTrips />} />
          <Route path="/notebook" element={<PlacesNotebook />} />
        </Route>

        <Route element={<GlobalSettingsLayoutWrapper />}>
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/trips/:id" element={<TripLayoutWrapper />}>
          <Route index element={<Navigate to="schedule" replace />} />
          <Route path="schedule" element={<TripSchedule />} />
          <Route path="overview" element={<TripOverview />} />
          <Route path="expenses" element={<TripExpenses />} />
          <Route path="members" element={<TripMembers />} />
          <Route path="places" element={<TripPlaces />} />
          <Route path="packing" element={<TripPacking />} />
          <Route path="photos" element={<TripPhotos />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
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
        message: 'Bạn vừa được mời vào một chuyến đi mới! Bấm vào logo Avatar góc phải để nhận quyền nhé.',
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
        title: 'Lời mời sổ tay mới',
        message: 'Bạn vừa được mời vào một sổ tay mới. Mở Cài đặt để nhận quyền nhé.',
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
      <AppRoutes />
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FeedbackProvider>
        <SettingsProvider>
          <AuthProvider>
            <AppProvider>
              <NotebookProvider>
                <AppShell />
              </NotebookProvider>
            </AppProvider>
          </AuthProvider>
        </SettingsProvider>
      </FeedbackProvider>
    </ErrorBoundary>
  );
}
