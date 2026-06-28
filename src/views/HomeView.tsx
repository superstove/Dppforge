import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  FileText, Upload, BarChart3, Factory, Globe, BookOpen,
  ArrowRight, Sparkles, Shield, Zap, QrCode, Brain,
  ChevronRight, Database, Eye
} from 'lucide-react';

export function HomeView({ setView }: { setView: (v: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="relative min-h-[calc(100svh-4rem)] flex flex-col items-center px-4 py-10 sm:p-8 overflow-hidden bg-[#0a0b10]">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[120vw] h-[50vh] bg-gradient-to-b from-blue-500/[0.07] via-purple-500/[0.04] to-transparent blur-[100px] rounded-full" />
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[60vw] h-[30vh] bg-white/[0.03] blur-[80px] rounded-full" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Title */}
      <div
        className="text-center relative z-10 mb-6 transition-all duration-700 delay-100 ease-out"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(30px)' }}
      >
        <h1 className="text-6xl sm:text-8xl lg:text-[9rem] font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/30 select-none leading-[0.9] tracking-tight pb-2">
          DPP Forge
        </h1>
      </div>

      {/* Subtitle */}
      <p
        className="text-center text-[#6b7280] text-sm sm:text-base max-w-lg mx-auto leading-relaxed relative z-10 mb-10 transition-all duration-700 delay-200 ease-out"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)' }}
      >
        Convert TDS, EPD, DoP & Test Reports into structured JSON passports
        with <span className="text-[#a0a8bf]">AI-powered extraction</span>, <span className="text-[#a0a8bf]">confidence scoring</span>, and <span className="text-[#a0a8bf]">QR verification</span>.
      </p>

      {/* Primary action cards */}
      <div
        className="flex flex-col sm:flex-row gap-4 relative z-10 w-full max-w-3xl mb-8 transition-all duration-700 delay-300 ease-out"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(30px)' }}
      >
        <ActionCard
          onClick={() => setView('manual')}
          icon={<FileText className="w-6 h-6" />}
          title="Manual Entry"
          desc="Build a passport from scratch with guided field-by-field input"
          accent="blue"
        />
        <ActionCard
          onClick={() => setView('upload')}
          icon={<Upload className="w-6 h-6" />}
          title="Upload Document"
          desc="Drop a PDF and let AI extract, map, and validate your product data"
          accent="purple"
          featured
        />
      </div>

      {/* How it works mini-flow */}
      <div
        className="relative z-10 w-full max-w-3xl mb-10 transition-all duration-700 delay-400 ease-out"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <div className="bg-[#12141c] border border-[#1e2030] rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#63677a]" />
            <span className="text-xs font-semibold text-[#63677a] uppercase tracking-wider">How it works</span>
          </div>
          <div className="flex items-center justify-between gap-2 sm:gap-0">
            <FlowDot icon={<Upload className="w-4 h-4" />} label="Upload" num={1} />
            <FlowLine />
            <FlowDot icon={<Brain className="w-4 h-4" />} label="AI Extract" num={2} />
            <FlowLine />
            <FlowDot icon={<Eye className="w-4 h-4" />} label="Review" num={3} />
            <FlowLine />
            <FlowDot icon={<QrCode className="w-4 h-4" />} label="DPP + QR" num={4} />
          </div>
        </div>
      </div>

      {/* Quick nav grid */}
      <div
        className="relative z-10 w-full max-w-3xl mb-8 transition-all duration-700 delay-500 ease-out"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickNav icon={<BarChart3 className="w-4 h-4" />} label="Dashboard" onClick={() => setView('dashboard')} />
          <QuickNav icon={<Factory className="w-4 h-4" />} label="Manufacturers" onClick={() => setView('manufacturers')} />
          <QuickNav icon={<Globe className="w-4 h-4" />} label="Market Coverage" onClick={() => setView('market')} />
          <QuickNav icon={<BookOpen className="w-4 h-4" />} label="Tutorial" onClick={() => setView('tutorial')} />
        </div>
      </div>

      {/* Feature pills */}
      <div
        className="relative z-10 flex flex-wrap justify-center gap-2 max-w-2xl transition-all duration-700 delay-[600ms] ease-out"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        <FeaturePill icon={<Shield className="w-3 h-3" />} text="EU ESPR Compliant" />
        <FeaturePill icon={<Brain className="w-3 h-3" />} text="Gemini + OpenAI" />
        <FeaturePill icon={<Database className="w-3 h-3" />} text="4 Document Types" />
        <FeaturePill icon={<QrCode className="w-3 h-3" />} text="Dual QR System" />
      </div>
    </div>
  );
}

/* ─── Subcomponents ─── */

const ACCENT = {
  blue: {
    icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20',
    ring: 'group-hover:border-blue-500/30',
  },
  purple: {
    icon: 'bg-purple-500/10 border-purple-500/20 text-purple-400 group-hover:bg-purple-500/20',
    ring: 'group-hover:border-purple-500/30',
  },
};

function ActionCard({ onClick, icon, title, desc, accent, featured }: {
  onClick: () => void; icon: ReactNode; title: string; desc: string;
  accent: keyof typeof ACCENT; featured?: boolean;
}) {
  const a = ACCENT[accent];
  return (
    <button
      onClick={onClick}
      className={`flex-1 group text-left rounded-2xl p-6 border transition-all duration-300 ${a.ring} ${
        featured
          ? 'bg-[#12141c] border-[#1e2030] hover:bg-[#161822]'
          : 'bg-[#12141c] border-[#1e2030] hover:bg-[#161822]'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 transition-all duration-300 ${a.icon}`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
        {title}
        <ArrowRight className="w-4 h-4 text-[#63677a] group-hover:text-white group-hover:translate-x-1 transition-all" />
      </h3>
      <p className="text-sm text-[#6b7280] leading-relaxed">{desc}</p>
      {featured && (
        <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-purple-400/70">
          <Sparkles className="w-3 h-3" /> AI-powered
        </div>
      )}
    </button>
  );
}

function FlowDot({ icon, label, num }: { icon: ReactNode; label: string; num: number }) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-[60px]">
      <div className="relative">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#1a1d27] border border-[#2e3245] flex items-center justify-center text-[#8b8fa3]">
          {icon}
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#12141c] border border-[#2e3245] flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#63677a]">{num}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-[#63677a]">{label}</span>
    </div>
  );
}

function FlowLine() {
  return (
    <div className="flex-1 h-px bg-gradient-to-r from-[#2e3245] via-[#3e4255] to-[#2e3245] mx-1 hidden sm:block" />
  );
}

function QuickNav({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-[#6b7280] bg-[#12141c] border border-[#1e2030] hover:border-[#2e3245] hover:text-white hover:bg-[#161822] transition-all"
    >
      <span className="text-[#4b5060] group-hover:text-white transition-colors">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 text-[#2e3245] group-hover:text-[#63677a] transition-colors" />
    </button>
  );
}

function FeaturePill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] text-[11px] text-[#4b5060] font-medium">
      {icon}
      {text}
    </div>
  );
}
