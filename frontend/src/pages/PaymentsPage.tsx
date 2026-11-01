import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentsAPI } from '../services/api';
import { Payment } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const { business } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : undefined;
      const res = await paymentsAPI.list(params);
      setPayments(res.data);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  const totalCaptured = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Reconciliation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified PayPal Orders &amp; Captures with automated balance reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Total Confirmed Reconciled:{' '}
            <strong className="font-mono">{business?.currency} {totalCaptured.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {['all', 'completed', 'initiated', 'failed', 'refunded'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
              statusFilter === st
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <Card>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading payments ledger...</p>
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payment records found"
            description="Payments captured via PayPal Sandbox will appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Customer / Payer</th>
                  <th className="px-6 py-3">PayPal Order ID</th>
                  <th className="px-6 py-3">PayPal Capture ID</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-slate-500">
                      {new Date(p.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                      <Link to={`/invoices/${p.invoice_id}`} className="hover:text-indigo-600">
                        {p.invoice_number || 'View Invoice'}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      {p.customer_name || 'PayPal Payer'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">
                      {p.provider_order_id ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {p.provider_order_id}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">
                      {p.provider_capture_id ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {p.provider_capture_id}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      +{p.currency} {Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={p.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
