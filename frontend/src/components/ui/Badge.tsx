import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const norm = status.toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = status.replace('_', ' ');

  switch (norm) {
    case 'paid':
    case 'completed':
    case 'sent':
      styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'overdue':
    case 'failed':
      styles = 'bg-rose-50 text-rose-700 border-rose-200';
      break;
    case 'partially_paid':
    case 'pending':
      styles = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'issued':
    case 'initiated':
    case 'scheduled':
      styles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      break;
    case 'draft':
      styles = 'bg-slate-100 text-slate-700 border-slate-200';
      break;
    case 'cancelled':
    case 'refunded':
      styles = 'bg-slate-100 text-slate-500 border-slate-300';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium capitalize rounded-full border ${sizeClasses} ${styles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {label}
    </span>
  );
};
