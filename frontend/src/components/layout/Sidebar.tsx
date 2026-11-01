import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  Users,
  CreditCard,
  Bot,
  BellRing,
  BarChart3,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const Sidebar: React.FC = () => {
  const { business } = useAuth();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/invoices', label: 'Invoices', icon: Receipt },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/ai-assistant', label: 'AI Assistant', icon: Bot, highlight: true },
    { to: '/reminders', label: 'Reminders', icon: BellRing },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-white text-base tracking-tight font-sans">PayPilot</span>
          <span className="text-xs font-semibold text-indigo-400 ml-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
            AI
          </span>
        </div>
      </div>

      {/* Business Info Capsule */}
      <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-800 text-xs">
        <div className="text-slate-400 font-medium truncate">{business?.name || 'My Business'}</div>
        <div className="flex items-center gap-1.5 mt-1 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Currency:</span>
          <span className="font-mono font-semibold text-white">{business?.currency || 'USD'}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.highlight && (
                <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  New
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>PayPal Sandbox</span>
        </div>
        <span className="text-[11px] font-mono text-slate-600">v1.0.0</span>
      </div>
    </aside>
  );
};
