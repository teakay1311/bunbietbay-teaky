/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { SettingsProvider } from './context/SettingsContext';
import { Login } from './screens/Login';
import { MyTrips } from './screens/MyTrips';
import { TripSchedule } from './screens/TripSchedule';
import { TripOverview } from './screens/TripOverview';
import { TripExpenses } from './screens/TripExpenses';
import { TripMembers } from './screens/TripMembers';
import { TripPlaces } from './screens/TripPlaces';
import { TripPacking } from './screens/TripPacking';
import { TripPhotos } from './screens/TripPhotos';
import { Settings } from './screens/Settings';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function AppContent() {
  useKeyboardShortcuts();
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/trips" element={<MyTrips />} />
      <Route path="/trips/:id/schedule" element={<TripSchedule />} />
      <Route path="/trips/:id/overview" element={<TripOverview />} />
      <Route path="/trips/:id/expenses" element={<TripExpenses />} />
      <Route path="/trips/:id/members" element={<TripMembers />} />
      <Route path="/trips/:id/places" element={<TripPlaces />} />
      <Route path="/trips/:id/packing" element={<TripPacking />} />
      <Route path="/trips/:id/photos" element={<TripPhotos />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const Router = import.meta.env.VITE_USE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

  return (
    <SettingsProvider>
      <AppProvider>
        <Router>
          <AppContent />
        </Router>
      </AppProvider>
    </SettingsProvider>
  );
}
