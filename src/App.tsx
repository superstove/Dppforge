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

export default function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [conversionResult, setConversionResult] = useState<any>(null);
  const [savedResult, setSavedResult] = useState<any>(null);

  const handleReview = (data: any) => {
    setConversionResult(data);
    setCurrentView('review');
  };

  const handleSaved = (data: any) => {
    setSavedResult(data);
    setCurrentView('saved');
  };

  return (
    <div className="flex h-screen bg-black text-[#e4e6ed] font-sans overflow-hidden selection:bg-white/30">
      <Sidebar currentView={currentView} setView={setCurrentView} />
      
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0b10]">
        <TopNav setView={setCurrentView} />
        
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
        </main>
      </div>
    </div>
  );
}
