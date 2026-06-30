/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { HomeView } from './views/HomeView';
import { ManualEntryView } from './views/ManualEntryView';
import { UploadView } from './views/UploadView';
import { ReviewView } from './views/ReviewView';
import { SuccessView } from './views/SuccessView';
import { PassportsView } from './views/PassportsView';
import { PublicPassportView } from './views/PublicPassportView';
import { SettingsView } from './views/SettingsView';
import { DashboardView } from './views/DashboardView';
import { ManufacturersView } from './views/ManufacturersView';
import { MarketCoverageView } from './views/MarketCoverageView';
import { TutorialView } from './views/TutorialView';
import { ComplianceView } from './views/ComplianceView';
import { NotificationsView } from './views/NotificationsView';
import { WelcomeModal } from './components/WelcomeModal';
import type { ConversionResult, SaveResult, ViewName } from './types';

function PublicPassportRoute() {
  const [searchParams] = useSearchParams();
  const passportId = searchParams.get('passport');
  if (passportId) return <PublicPassportView passportId={passportId} />;
  return <AppShell />;
}

const VIEW_TO_PATH: Record<ViewName, string> = {
  home: '/',
  dashboard: '/dashboard',
  manual: '/manual',
  upload: '/upload',
  review: '/review',
  saved: '/saved',
  passports: '/passports',
  manufacturers: '/manufacturers',
  market: '/market',
  tutorial: '/tutorial',
  compliance: '/compliance',
  notifications: '/notifications',
  settings: '/settings',
};

function AppShell() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [savedResult, setSavedResult] = useState<SaveResult | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const setView = (view: ViewName | string) => {
    const path = VIEW_TO_PATH[view as ViewName] || '/';
    navigate(path);
  };

  const handleReview = (data: ConversionResult) => {
    setConversionResult(data);
    navigate('/review');
  };

  const handleSaved = (data: SaveResult) => {
    setSavedResult(data);
    navigate('/saved');
  };

  return (
    <div className="flex h-[100svh] bg-black text-[#e4e6ed] font-sans overflow-hidden selection:bg-white/30">
      <WelcomeModal forceOpen={tourOpen} onClose={() => setTourOpen(false)} />
      <Sidebar
        currentView={location.pathname}
        setView={setView}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setSidebarCollapsed(true)}
        onReplayTour={() => setTourOpen(true)}
      />

      <div className="min-w-0 flex-1 flex flex-col relative overflow-hidden bg-[#0a0b10]">
        <TopNav
          setView={setView}
          onOpenSidebar={() => {
            setSidebarCollapsed(false);
            setSidebarOpen(true);
          }}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto relative z-10 custom-scrollbar touch-scroll">
          <Routes>
            <Route path="/" element={<HomeView setView={setView} />} />
            <Route path="/manual" element={<ManualEntryView setView={setView} onReview={handleReview} />} />
            <Route path="/upload" element={<UploadView setView={setView} onReview={handleReview} />} />
            <Route path="/review" element={
              conversionResult
                ? <ReviewView setView={setView} data={conversionResult} onSaved={handleSaved} sidebarCollapsed={sidebarCollapsed} />
                : <HomeView setView={setView} />
            } />
            <Route path="/saved" element={
              savedResult
                ? <SuccessView setView={setView} data={savedResult} />
                : <HomeView setView={setView} />
            } />
            <Route path="/passports" element={<PassportsView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/manufacturers" element={<ManufacturersView />} />
            <Route path="/market" element={<MarketCoverageView />} />
            <Route path="/tutorial" element={<TutorialView />} />
            <Route path="/compliance" element={<ComplianceView />} />
            <Route path="/notifications" element={<NotificationsView />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<HomeView setView={setView} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<PublicPassportRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
