import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Home, Plus, Database, Settings, LayoutDashboard, BarChart3, Factory, Globe, BookOpen, Shield, Bell, Columns3, HardHat, Menu, User } from 'lucide-react';
import { useRole, type OperatorRole } from '../RoleContext';

const OPERATOR_ROLES: { id: OperatorRole; label: string; color: string; desc: string }[] = [
  { id: 'engineer', label: 'Product Passport Engineer', color: 'text-blue-400', desc: 'Create & edit passports, attach source docs, manage QA records' },
  { id: 'reviewer', label: 'Reviewer / Approver', color: 'text-green-400', desc: 'Approve DPPs for publication, review manufacturer claims' },
  { id: 'admin', label: 'Admin', color: 'text-purple-400', desc: 'Full access — delete passports, manage settings, all actions' },
];

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
  const { role, setRole } = useRole();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const currentRole = OPERATOR_ROLES.find(r => r.id === role) || OPERATOR_ROLES[0];

  const activeIdx = NAV_ITEMS.findIndex(item => {
    if (item.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.path);
  });

  const activeItem = activeIdx >= 0 ? NAV_ITEMS[activeIdx] : null;

  return (
    <header className="min-h-14 border-b border-[#2e3245] flex items-center bg-[#0f1117]/90 backdrop-blur-xl z-20 sticky top-0">
      {/* Mobile: hamburger + logo */}
      <div className="flex md:hidden items-center px-4 gap-3 w-full">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg text-[#8b8fa3] hover:text-white hover:bg-[#1a1d27] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 bg-white text-black font-bold flex items-center justify-center rounded-sm">
            <HardHat className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-wider text-white">DPP FORGE</span>
        </div>
        <button onClick={() => setShowRoleMenu(!showRoleMenu)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-[#1a1d27] border border-[#2e3245] ${currentRole.color}`}>
          <User className="w-3 h-3" />
        </button>
      </div>

      {/* Role dropdown (shared mobile + desktop) */}
      {showRoleMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setShowRoleMenu(false)}>
          <div className="absolute right-4 top-14 w-72 bg-[#1a1d27] border border-[#2e3245] rounded-xl shadow-2xl z-50 py-1" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-[#2e3245]">
              <p className="text-xs font-semibold text-white">Operator Role</p>
              <p className="text-[10px] text-[#63677a] mt-0.5">Controls which actions are available</p>
            </div>
            {OPERATOR_ROLES.map(r => (
              <button key={r.id} onClick={() => { setRole(r.id); setShowRoleMenu(false); }} className={`w-full text-left px-4 py-3 hover:bg-[#242736] transition-colors ${r.id === role ? 'bg-[#242736]' : ''}`}>
                <div className={`text-xs font-semibold ${r.id === role ? r.color : 'text-[#c0c4d6]'}`}>
                  {r.id === role && '● '}{r.label}
                </div>
                <div className="text-[10px] text-[#63677a] mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop */}
      <div className="hidden md:flex items-center w-full px-4 py-2">
        {/* When sidebar is visible: show page title breadcrumb */}
        {!sidebarCollapsed && (
          <div className="flex items-center justify-between gap-3 w-full">
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
            <button onClick={() => setShowRoleMenu(!showRoleMenu)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1a1d27] border border-[#2e3245] ${currentRole.color} hover:bg-[#242736] transition-colors`}>
              <User className="w-3 h-3" />
              <span className="hidden lg:inline">{currentRole.label}</span>
            </button>
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
              className="relative flex flex-wrap items-center gap-1.5 flex-1 min-w-0 px-2"
              aria-label="Primary navigation"
            >
              {NAV_ITEMS.map((item, idx) => {
                const isActive = activeIdx === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`relative flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors lg:px-3
                      ${isActive
                        ? 'bg-white/[0.10] text-white'
                        : 'text-[#8b8fa3] hover:bg-white/[0.06] hover:text-white'
                      }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-[9px] left-1/2 h-[2px] w-4/5 -translate-x-1/2 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </nav>

            <button onClick={() => setShowRoleMenu(!showRoleMenu)} className={`ml-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-[#1a1d27] border border-[#2e3245] ${currentRole.color} hover:bg-[#242736] transition-colors flex-shrink-0`}>
              <User className="w-3 h-3" />
              <span className="hidden xl:inline">{currentRole.label}</span>
            </button>

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
