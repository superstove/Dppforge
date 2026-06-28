import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Home, Plus, Database, Settings, LayoutDashboard, BarChart3, Factory, Globe, BookOpen, Shield, Bell, Columns3, HardHat, Menu } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', path: '/', label: 'Home', icon: Home },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'manual', path: '/manual', label: 'Entry', icon: Plus },
  { id: 'upload', path: '/upload', label: 'Upload', icon: LayoutDashboard },
  { id: 'passports', path: '/passports', label: 'Passports', icon: Database },
  { id: 'manufacturers', path: '/manufacturers', label: 'Manufacturers', icon: Factory },
  { id: 'market', path: '/market', label: 'Market', icon: Globe },
  { id: 'compliance', path: '/compliance', label: 'Compliance', icon: Shield },
  { id: 'notifications', path: '/notifications', label: 'Alerts', icon: Bell },
  { id: 'tutorial', path: '/tutorial', label: 'Tutorial', icon: BookOpen },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
];

export function TopNav({
  setView,
  onOpenSidebar,
  sidebarCollapsed = false,
}: {
  setView: (v: string) => void;
  onOpenSidebar: () => void;
  sidebarCollapsed?: boolean;
}) {
  const location = useLocation();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeIdx = NAV_ITEMS.findIndex(item => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  const activeItem = activeIdx >= 0 ? NAV_ITEMS[activeIdx] : null;

  useEffect(() => {
    if (!sidebarCollapsed) return;
    const update = () => {
      const idx = hoveredIdx ?? activeIdx;
      const el = itemRefs.current[idx];
      const container = navRef.current;
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setSpotlightStyle({
          left: elRect.left - containerRect.left,
          width: elRect.width,
          opacity: 1,
          transition: hoveredIdx !== null ? 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        });
      } else {
        setSpotlightStyle({ opacity: 0 });
      }
    };
    requestAnimationFrame(update);
  }, [hoveredIdx, activeIdx, location.pathname, sidebarCollapsed]);

  return (
    <header className="h-14 border-b border-[#2e3245] flex items-center bg-[#0f1117]/90 backdrop-blur-xl z-20 sticky top-0">
      {/* Mobile: hamburger + logo */}
      <div className="flex md:hidden items-center px-4 gap-3 w-full">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg text-[#8b8fa3] hover:text-white hover:bg-[#1a1d27] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white text-black font-bold flex items-center justify-center rounded-sm">
            <HardHat className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-wider text-white">DPP FORGE</span>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center w-full px-4">
        {/* When sidebar is visible: show page title breadcrumb */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-xs text-[#63677a] uppercase tracking-[0.15em] font-semibold">
              <span>DPP FORGE</span>
              {activeItem && (
                <>
                  <span className="text-[#2e3245]">/</span>
                  <span className="text-white flex items-center gap-1.5">
                    <activeItem.icon className="w-3.5 h-3.5" />
                    {activeItem.label}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* When sidebar is collapsed: full spotlight navbar */}
        {sidebarCollapsed && (
          <>
            <button
              onClick={() => setView('home')}
              className="flex items-center gap-2.5 mr-4 flex-shrink-0 group"
            >
              <div className="w-8 h-8 bg-white text-black font-bold flex items-center justify-center rounded-md group-hover:scale-105 transition-transform">
                <HardHat className="w-4.5 h-4.5" />
              </div>
              <span className="font-bold text-sm tracking-[0.15em] text-white hidden lg:block">DPP FORGE</span>
            </button>

            <div className="w-px h-6 bg-[#2e3245] mr-2 flex-shrink-0"></div>

            <nav
              ref={navRef}
              className="relative flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none px-2"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 h-9 rounded-lg bg-white/[0.08] pointer-events-none"
                style={spotlightStyle}
              />

              {NAV_ITEMS.map((item, idx) => {
                const isActive = activeIdx === idx;
                return (
                  <button
                    key={item.id}
                    ref={el => { itemRefs.current[idx] = el; }}
                    onClick={() => setView(item.id)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors flex-shrink-0 z-10
                      ${isActive
                        ? 'text-white'
                        : 'text-[#8b8fa3] hover:text-white'
                      }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-[11px] left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-white rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={onOpenSidebar}
              className="ml-2 p-2 rounded-lg text-[#63677a] hover:text-white hover:bg-[#1a1d27] transition-colors flex-shrink-0"
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <Columns3 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
