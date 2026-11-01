import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Bot, LogOut, User as UserIcon, Building2 } from 'lucide-react';

export const TopNav: React.FC = () => {
  const { user, business, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Quick Search / Assistant Prompt Pill */}
      <div className="flex items-center gap-3">
        <Link
          to="/ai-assistant"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-xs font-medium text-slate-700 transition-colors border border-slate-200"
        >
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ask PayPilot AI: &quot;Show overdue invoices&quot;</span>
          <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-slate-400 border border-slate-200 font-mono">
            /
          </span>
        </Link>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Business Selector Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">{business?.name}</span>
          <span className="text-slate-400">•</span>
          <span className="font-mono text-slate-500">{business?.currency}</span>
        </div>

        {/* User Pill & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-semibold text-xs">
              {user?.full_name?.charAt(0) || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-none">{user?.full_name}</div>
              <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
