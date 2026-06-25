export function TopNav({ setView }: { setView: (v: string) => void }) {
  return (
    <header className="h-16 border-b border-[#2e3245] flex items-center justify-between px-6 bg-[#0f1117]/80 backdrop-blur-md z-20 sticky top-0">
      <div className="flex items-center space-x-6 text-xs font-semibold text-[#8b8fa3] uppercase tracking-[0.2em]">
        <button onClick={() => setView('home')} className="hover:text-white transition-colors text-white">DPP FORGE</button>
      </div>
    </header>
  );
}
