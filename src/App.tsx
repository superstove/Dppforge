/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
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
import type { ViewName, ConversionResult, SaveResult } from './types';

export default function App() {
  const publicPassportId = new URLSearchParams(window.location.search).get('passport');
  const [currentView, setCurrentView] = useState<ViewName>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [savedResult, setSavedResult] = useState<SaveResult | null>(null);

  const handleReview = (data: ConversionResult) => {
    setConversionResult(data);
    setCurrentView('review');
  };

  const handleSaved = (data: SaveResult) => {
    setSavedResult(data);
    setCurrentView('saved');
  };

  if (publicPassportId) {
    return <PublicPassportView passportId={publicPassportId} />;
  }

  return (
    <div className="flex h-[100svh] bg-black text-[#e4e6ed] font-sans overflow-hidden selection:bg-white/30">
      <Sidebar
        currentView={currentView}
        setView={setCurrentView}
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setSidebarCollapsed(true)}
      />
      
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0b10]">
        <TopNav
          setView={setCurrentView}
          onOpenSidebar={() => {
            setSidebarCollapsed(false);
            setSidebarOpen(true);
          }}
          sidebarCollapsed={sidebarCollapsed}
        />
        
        <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          {currentView === 'home' && <HomeView setView={setCurrentView} />}
          {currentView === 'manual' && <ManualEntryView setView={setCurrentView} onReview={handleReview} />}
          {currentView === 'upload' && <UploadView setView={setCurrentView} onReview={handleReview} />}
          {currentView === 'review' && conversionResult && (
            <ReviewView setView={setCurrentView} data={conversionResult} onSaved={handleSaved} />
          )}
          {currentView === 'saved' && savedResult && (
             <SuccessView setView={setCurrentView} data={savedResult} />
          )}
          {currentView === 'passports' && <PassportsView />}
          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
