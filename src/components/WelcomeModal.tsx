import { useState, useEffect } from 'react';
import { X, Sparkles, FileText, QrCode, Factory, ArrowRight, Home, BarChart3, Plus, LayoutDashboard, Database, Globe, BookOpen, Shield, Bell, Settings, ChevronRight } from 'lucide-react';

const SIDEBAR_ITEMS = [
  { icon: Home, label: 'Home', desc: 'Landing page with quick-start actions' },
  { icon: BarChart3, label: 'Dashboard', desc: 'Analytics, KPIs, and confidence charts' },
  { icon: Plus, label: 'Manual Entry', desc: 'Create a passport by filling in product data' },
  { icon: LayoutDashboard, label: 'Upload PDF', desc: 'AI-extract data from TDS, EPD, DoP, or Test Reports' },
  { icon: Database, label: 'Saved Passports', desc: 'View, edit, export (PDF/IFC/JSON) all passports' },
  { icon: Factory, label: 'Manufacturers', desc: 'CRM pipeline: track outreach & onboarding' },
  { icon: Globe, label: 'Market Coverage', desc: 'Category-level coverage analysis & standards' },
  { icon: BookOpen, label: 'Tutorial', desc: 'Learn every term, page, and feature' },
  { icon: Shield, label: 'EU Compliance', desc: 'ESPR checks, GS1 IDs, carbon calc, registry export' },
  { icon: Bell, label: 'Alerts & Languages', desc: 'Webhooks, expiry alerts, multi-language DPP export' },
  { icon: Settings, label: 'Settings', desc: 'API keys, model config, and preferences' },
];

interface WelcomeModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function WelcomeModal({ forceOpen, onClose }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'welcome' | 'sidebar'>('welcome');

  useEffect(() => {
    if (forceOpen) {
      setStep('welcome');
      setIsOpen(true);
    }
  }, [forceOpen]);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('dpp_forge_welcome_seen');
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('dpp_forge_welcome_seen', 'true');
    setIsOpen(false);
    setStep('welcome');
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="absolute inset-0" onClick={handleClose}></div>

      <div className="relative bg-[#1a1d27] border border-[#2e3245] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90svh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-[#8b8fa3] hover:text-white hover:bg-[#2a2d3d] rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'welcome' ? (
          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Welcome to DPP Forge</h2>
                <p className="text-[#8b8fa3] text-sm mt-1">Your Digital Product Passport Operating System</p>
              </div>
            </div>

            <div className="space-y-6 text-[#a0aab8] text-sm sm:text-base leading-relaxed">
              <p>
                DPP Forge is an enterprise-grade platform built specifically for the construction and civil engineering sector to create, manage, and verify <strong className="text-white">Digital Product Passports (DPPs)</strong>.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 mt-6">
                <div className="bg-[#11131a] border border-[#2e3245] p-4 rounded-xl">
                  <FileText className="w-5 h-5 text-blue-400 mb-3" />
                  <h3 className="text-white font-medium mb-1">AI-Powered Extraction</h3>
                  <p className="text-xs text-[#8b8fa3]">Upload TDS, EPD, DoP, or Test Reports. Our multi-model AI pipeline extracts and standardizes unstructured PDFs into strict JSON schemas with field-level confidence scoring.</p>
                </div>
                <div className="bg-[#11131a] border border-[#2e3245] p-4 rounded-xl">
                  <QrCode className="w-5 h-5 text-purple-400 mb-3" />
                  <h3 className="text-white font-medium mb-1">Verifiable Passports</h3>
                  <p className="text-xs text-[#8b8fa3]">Generate Master QR codes that serve as a single source of truth for your product data across the entire supply chain.</p>
                </div>
                <div className="bg-[#11131a] border border-[#2e3245] p-4 rounded-xl sm:col-span-2">
                  <Factory className="w-5 h-5 text-emerald-400 mb-3" />
                  <h3 className="text-white font-medium mb-1">Built-in Manufacturer CRM</h3>
                  <p className="text-xs text-[#8b8fa3]">More than just data extraction. Manage manufacturer outreach, track onboarding pipelines (Targets &rarr; Engaged &rarr; Active), and analyze market coverage directly in the app.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#2e3245]"></div>
              </div>
              <button
                onClick={() => setStep('sidebar')}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Next: Explore Pages <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 sm:p-10">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">Your Navigation Sidebar</h2>
              <p className="text-[#8b8fa3] text-sm">Use the sidebar on the left to navigate between pages. Here's what each one does:</p>
            </div>

            <div className="space-y-1.5 max-h-[40svh] overflow-y-auto custom-scrollbar pr-1">
              {SIDEBAR_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-3 bg-[#11131a] border border-[#2e3245] rounded-xl px-4 py-3 group hover:border-[#4e5269] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#1a1d27] border border-[#2e3245] flex items-center justify-center flex-shrink-0 group-hover:border-white/20 transition-colors">
                    <item.icon className="w-4.5 h-4.5 text-[#8b8fa3] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{item.label}</p>
                    <p className="text-[#63677a] text-xs">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#2e3245] group-hover:text-[#63677a] transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>

            <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <p className="text-blue-300 text-xs leading-relaxed">
                <strong>Tip:</strong> On mobile, tap the menu icon (top-left) to open the sidebar. On desktop, it's always visible on the left side of the screen.
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setStep('welcome')} className="w-2.5 h-2.5 rounded-full bg-[#2e3245] hover:bg-[#4e5269] transition-colors"></button>
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
