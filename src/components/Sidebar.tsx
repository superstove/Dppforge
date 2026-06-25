import { Home, Plus, Database, Settings, LayoutDashboard, HardHat } from 'lucide-react';

export function Sidebar({ currentView, setView }: { currentView: string, setView: (v: string) => void }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'manual', label: 'Manual Entry', icon: Plus },
    { id: 'upload', label: 'Upload PDF', icon: LayoutDashboard },
    { id: 'passports', label: 'Saved Passports', icon: Database },
  ];

  return (
    <aside className="w-64 border-r border-[#2e3245] bg-[#0f1117] flex flex-col hidden md:flex">
      <div 
        onClick={() => setView('home')}
        className="h-16 flex items-center px-6 border-b border-[#2e3245] cursor-pointer hover:bg-[#1a1d27] transition-colors"
      >
        <div className="w-8 h-8 bg-white text-black font-bold flex items-center justify-center rounded-sm mr-3">
          <HardHat className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-wider text-white">DPP FORGE</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors font-medium text-sm ${
              currentView === item.id 
                ? 'bg-[#1a1d27] text-white' 
                : 'text-[#8b8fa3] hover:bg-[#1a1d27] hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-[#2e3245]">
        <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-[#8b8fa3] hover:bg-[#1a1d27] hover:text-white transition-colors font-medium text-sm">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
