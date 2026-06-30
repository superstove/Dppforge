import { Home, Plus, Database, Settings, LayoutDashboard, HardHat, X, BarChart3, Factory, Globe, BookOpen, Shield, Bell, HelpCircle } from 'lucide-react';

export function Sidebar({
  currentView,
  setView,
  isOpen = false,
  isCollapsed = false,
  onClose,
  onCollapse,
  onReplayTour,
}: {
  currentView: string;
  setView: (v: string) => void;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onReplayTour?: () => void;
}) {
  const navItems = [
    { id: 'home', path: '/', label: 'Home', icon: Home },
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'manual', path: '/manual', label: 'Manual Entry', icon: Plus },
    { id: 'upload', path: '/upload', label: 'Upload PDF', icon: LayoutDashboard },
    { id: 'passports', path: '/passports', label: 'Saved Passports', icon: Database },
    { id: 'manufacturers', path: '/manufacturers', label: 'Manufacturers', icon: Factory },
    { id: 'market', path: '/market', label: 'Market Coverage', icon: Globe },
    { id: 'compliance', path: '/compliance', label: 'EU Compliance', icon: Shield },
    { id: 'notifications', path: '/notifications', label: 'Alerts & Languages', icon: Bell },
    { id: 'tutorial', path: '/tutorial', label: 'Tutorial', icon: BookOpen },
    { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (item: { id: string; path: string }) =>
    currentView === item.id || currentView === item.path;

  const handleNavigate = (view: string) => {
    setView(view);
    onClose?.();
  };

  const sidebarContent = (
    <>
      <div
        onClick={() => handleNavigate('home')}
        className="h-16 flex items-center px-6 border-b border-[#2e3245] cursor-pointer hover:bg-[#1a1d27] transition-colors"
      >
        <div className="w-8 h-8 bg-white text-black font-bold flex items-center justify-center rounded-sm mr-3">
          <HardHat className="w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-wider text-white">DPP FORGE</span>
        {onCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            className="ml-auto hidden md:flex p-2 rounded-lg text-[#8b8fa3] hover:text-white hover:bg-[#242736]"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {onClose && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="ml-auto md:hidden p-2 rounded-lg text-[#8b8fa3] hover:text-white hover:bg-[#242736]"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.id)}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors font-medium text-sm ${
              isActive(item)
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
        {onReplayTour && (
          <button
            onClick={() => { onReplayTour(); onClose?.(); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[#8b8fa3] hover:bg-[#1a1d27] hover:text-white transition-colors text-sm font-medium mb-2"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Replay Tour</span>
          </button>
        )}
        <p className="text-xs text-[#63677a] px-3">DPP Forge v1</p>
      </div>
    </>
  );

  return (
    <>
      {!isCollapsed && (
        <aside className="w-64 border-r border-[#2e3245] bg-[#0f1117] flex-col hidden md:flex">
          {sidebarContent}
        </aside>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close sidebar backdrop"
          />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-[#2e3245] bg-[#0f1117] flex flex-col shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
