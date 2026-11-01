import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import {
  Download, TrendingUp, AlertTriangle, Clock, CheckCircle, DollarSign,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import api from '../services/api';
import { AgingReport, MonthlyDataPoint } from '../types';

interface MonthlySummaryResponse {
  currency: string;
  data: MonthlyDataPoint[];
}

const BUCKET_COLORS = ['#6366f1', '#f59e0b', '#f97316', '#ef4444'];

export const AnalyticsPage: React.FC = () => {
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDataPoint[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [agingRes, monthlyRes] = await Promise.all([
          api.get<AgingReport>('/analytics/aging'),
          api.get<MonthlySummaryResponse>('/dashboard/monthly-summary'),
        ]);
        setAging(agingRes.data);
        setMonthly(monthlyRes.data.data ?? []);
        setCurrency(agingRes.data.currency ?? 'INR');
      } catch {
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('paypilot_token');
      const response = await fetch('/api/analytics/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paypilot-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-red-700">{error}</div>
    );
  }

  const buckets = aging?.buckets ?? [];
  const agingChartData = buckets.map((b, i) => ({
    name: b.range,
    amount: b.amount,
    count: b.invoice_count,
    fill: BUCKET_COLORS[i] ?? '#6366f1',
  }));

  // KPI amounts for the 4 stat cards
  const kpiAmounts = [
    buckets[0]?.amount ?? 0,
    buckets[1]?.amount ?? 0,
    (buckets[2]?.amount ?? 0) + (buckets[3]?.amount ?? 0), // 31-60 + 61-90 grouped
    aging?.total_outstanding ?? 0,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Receivables aging and monthly performance</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors text-sm font-medium"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Aging KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Current / Upcoming"
          amount={kpiAmounts[0]}
          currency={currency}
          icon={CheckCircle}
          variant="success"
          countLabel="invoices"
          count={buckets[0]?.invoice_count}
        />
        <StatCard
          title="1–30 Days Overdue"
          amount={kpiAmounts[1]}
          currency={currency}
          icon={Clock}
          variant="warning"
          countLabel="invoices"
          count={buckets[1]?.invoice_count}
        />
        <StatCard
          title="31–60 Days Overdue"
          amount={kpiAmounts[2]}
          currency={currency}
          icon={AlertTriangle}
          variant="danger"
          countLabel="invoices"
          count={(buckets[2]?.invoice_count ?? 0) + (buckets[3]?.invoice_count ?? 0)}
        />
        <StatCard
          title="Total Outstanding"
          amount={kpiAmounts[3]}
          currency={currency}
          icon={DollarSign}
          variant="danger"
        />
      </div>

      {/* Aging Bar Chart */}
      <Card title="Receivables Aging Report">
        {agingChartData.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-10">No outstanding receivables.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agingChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [
                  `${currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  'Outstanding',
                ]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Aging Detail Table */}
      {buckets.length > 0 && (
        <Card title="Aging Detail by Bucket">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Age Bucket</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Invoices</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket, i) => (
                  <tr
                    key={bucket.range}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: BUCKET_COLORS[i] ?? '#6366f1' }}
                        />
                        <span className="text-slate-700">{bucket.range}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">{bucket.invoice_count}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                      {currency} {bucket.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-700">Total</td>
                  <td className="py-2 px-3 text-right text-slate-700">
                    {buckets.reduce((s, b) => s + b.invoice_count, 0)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-900">
                    {currency}{' '}
                    {(aging?.total_outstanding ?? 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Monthly Trend */}
      {monthly.length > 0 && (
        <Card title="Monthly Invoiced vs Collected">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span className="text-sm text-slate-500">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                  name === 'invoiced' ? 'Invoiced' : 'Collected',
                ]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="invoiced"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Invoiced"
              />
              <Line
                type="monotone"
                dataKey="paid"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Collected"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
