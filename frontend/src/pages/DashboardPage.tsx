import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import { DashboardSummary, MonthlyDataPoint, Invoice } from '../types';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PayPalModal } from '../components/payments/PayPalModal';
import { ReminderModal } from '../components/reminders/ReminderModal';
import {
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  Plus,
  Bot,
  CreditCard,
  ArrowRight,
  TrendingUp,
  Loader2,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<Invoice | null>(null);
  const [selectedReminderInvoice, setSelectedReminderInvoice] = useState<Invoice | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, monthRes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getMonthlySummary(),
      ]);
      setSummary(sumRes.data);
      setMonthlyData(monthRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500">Calculating real-time financial summaries...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <EmptyState
        icon={Receipt}
        title="Could not load financial records"
        description="Please check your backend connection and database settings."
        actionLabel="Retry"
        onAction={loadData}
      />
    );
  }

  // Distribution chart data
  const statusColors: Record<string, string> = {
    paid: '#10b981',
    issued: '#6366f1',
    overdue: '#f43f5e',
    partially_paid: '#f59e0b',
    draft: '#94a3b8',
    cancelled: '#cbd5e1',
  };

  const pieData = Object.entries(summary.status_distribution || {})
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.replace('_', ' ').toUpperCase(),
      value: count,
      color: statusColors[status] || '#6366f1',
    }));

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time cash flow, pending balances, and reconciled PayPal payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/ai-assistant"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition-colors"
          >
            <Bot className="w-4 h-4 text-indigo-600" />
            <span>AI Financial Advisor</span>
          </Link>
          <Link
            to="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoiced"
          amount={summary.total_invoiced}
          currency={summary.currency}
          count={summary.recent_invoices.length}
          countLabel="active invoices"
          icon={Receipt}
          variant="primary"
        />
        <StatCard
          title="Confirmed Paid"
          amount={summary.total_paid}
          currency={summary.currency}
          count={summary.paid_invoices_count}
          countLabel="settled invoices"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Outstanding Balance"
          amount={summary.outstanding_balance}
          currency={summary.currency}
          count={summary.unpaid_invoices_count}
          countLabel="unpaid invoices"
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Overdue Balance"
          amount={summary.overdue_balance}
          currency={summary.currency}
          count={summary.overdue_invoices_count}
          countLabel="urgent invoices"
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Trend Chart */}
        <Card
          className="lg:col-span-2"
          title="Cashflow Performance (Invoiced vs Paid)"
          subtitle="Monthly billed amounts compared with confirmed settled revenue"
        >
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: number) => [`${summary.currency} ${val.toFixed(2)}`, '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                <Bar dataKey="paid" name="Confirmed Paid" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Breakdown Pie */}
        <Card title="Invoice Status Breakdown" subtitle="Current distribution of accounts receivable">
          <div className="h-56 w-full flex items-center justify-center">
            {pieData.length === 0 ? (
              <div className="text-center text-xs text-slate-400">No invoices generated yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [`${val} invoices`, 'Count']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="truncate">{d.name}:</span>
                <span className="font-semibold text-slate-900 ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tables Row: Recent Invoices & Recent Payment Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table */}
        <Card
          className="lg:col-span-2"
          title="Recent Invoices"
          subtitle="Latest client billing records"
          action={
            <Link to="/invoices" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {summary.recent_invoices.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No invoices yet. Click &quot;Create Invoice&quot; to begin.</div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3">Invoice</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Balance</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {summary.recent_invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                        <Link to={`/invoices/${inv.id}`} className="hover:text-indigo-600">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-800">{inv.customer_name}</td>
                      <td className="px-6 py-3.5 text-slate-500">{inv.due_date}</td>
                      <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                        {inv.currency} {Number(inv.balance_due).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge status={inv.status} size="sm" />
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        {inv.balance_due > 0 && inv.status !== 'draft' && (
                          <button
                            onClick={() => setSelectedPayInvoice(inv)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-semibold transition-colors"
                          >
                            Pay
                          </button>
                        )}
                        {inv.status === 'overdue' && (
                          <button
                            onClick={() => setSelectedReminderInvoice(inv)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                          >
                            Remind
                          </button>
                        )}
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="px-2 py-1 text-indigo-600 hover:text-indigo-800 text-[11px] font-medium"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent Payment Activity */}
        <Card
          title="Recent Payments"
          subtitle="Real-time PayPal Sandbox settlements"
          action={
            <Link to="/payments" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {summary.recent_payments.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No payment activity recorded yet.</div>
          ) : (
            <div className="space-y-3.5">
              {summary.recent_payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        p.status === 'completed'
                          ? 'bg-emerald-100/80 text-emerald-700'
                          : p.status === 'failed'
                          ? 'bg-rose-100/80 text-rose-700'
                          : 'bg-amber-100/80 text-amber-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{p.invoice_number}</div>
                      <div className="text-[11px] text-slate-500">{p.customer_name || 'PayPal Payer'}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-900">
                      +{p.currency} {Number(p.amount).toFixed(2)}
                    </div>
                    <div className="mt-0.5">
                      <Badge status={p.status} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      <PayPalModal
        isOpen={!!selectedPayInvoice}
        onClose={() => setSelectedPayInvoice(null)}
        invoice={selectedPayInvoice}
        onPaymentSuccess={loadData}
      />
      <ReminderModal
        isOpen={!!selectedReminderInvoice}
        onClose={() => setSelectedReminderInvoice(null)}
        invoice={selectedReminderInvoice}
        onReminderSent={loadData}
      />
    </div>
  );
};
