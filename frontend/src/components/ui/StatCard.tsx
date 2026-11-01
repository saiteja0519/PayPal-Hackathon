import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  amount: number;
  currency: string;
  count?: number;
  countLabel?: string;
  icon: LucideIcon;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  currency,
  count,
  countLabel,
  icon: Icon,
  variant = 'primary',
}) => {
  const colorMap = {
    primary: {
      bg: 'bg-indigo-50/80',
      text: 'text-indigo-600',
      border: 'border-indigo-100',
    },
    success: {
      bg: 'bg-emerald-50/80',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    warning: {
      bg: 'bg-amber-50/80',
      text: 'text-amber-600',
      border: 'border-amber-100',
    },
    danger: {
      bg: 'bg-rose-50/80',
      text: 'text-rose-600',
      border: 'border-rose-100',
    },
  };

  const c = colorMap[variant];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
          {currency} {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {count !== undefined && (
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{count}</span>
            <span>{countLabel || 'invoices'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
