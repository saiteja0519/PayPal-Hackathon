import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesAPI } from '../services/api';
import { Invoice, InvoiceStatus } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { PayPalModal } from '../components/payments/PayPalModal';
import { ReminderModal } from '../components/reminders/ReminderModal';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CreditCard,
  BellRing,
  Send,
  XCircle,
  Eye,
  Loader2,
} from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<Invoice | null>(null);
  const [selectedReminderInvoice, setSelectedReminderInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'overdue_only') {
          params.is_overdue = true;
        } else {
          params.status = selectedStatus;
        }
      }
      if (search) {
        params.search = search;
      }
      const res = await invoicesAPI.list(params);
      setInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleIssue = async (invoiceId: string) => {
    try {
      await invoicesAPI.issue(invoiceId);
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to issue invoice.');
    }
  };

  const handleCancel = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      await invoicesAPI.cancel(invoiceId);
      fetchInvoices();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel invoice.');
    }
  };

  const statusTabs = [
    { key: 'all', label: 'All Invoices' },
    { key: 'draft', label: 'Draft' },
    { key: 'issued', label: 'Issued' },
    { key: 'partially_paid', label: 'Partially Paid' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue_only', label: 'Overdue' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoice Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, track, issue, and reconcile customer invoices with PayPal Checkout.
          </p>
        </div>

        <Link
          to="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice</span>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 md:border-none">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedStatus === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 bg-white"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        </form>
      </div>

      {/* Table Card */}
      <Card>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description="There are no invoices matching your current status filter or search query."
            actionLabel="Create Invoice"
            onAction={() => (window.location.href = '/invoices/new')}
          />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-3">Invoice Number</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Issue Date</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Paid</th>
                  <th className="px-6 py-3 text-right">Balance Due</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                      <Link to={`/invoices/${inv.id}`} className="hover:text-indigo-600">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      <div>{inv.customer_name}</div>
                      <div className="text-[11px] text-slate-400">{inv.customer_email}</div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{inv.issue_date}</td>
                    <td className="px-6 py-3.5 text-slate-500 font-medium">
                      <span className={inv.status === 'overdue' ? 'text-rose-600 font-semibold' : ''}>
                        {inv.due_date}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-slate-900">
                      {inv.currency} {Number(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-medium">
                      {inv.currency} {Number(inv.paid_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      {inv.currency} {Number(inv.balance_due).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={inv.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Issue action for draft */}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleIssue(inv.id)}
                            title="Issue to customer"
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            <span>Issue</span>
                          </button>
                        )}

                        {/* Pay with PayPal Checkout button */}
                        {inv.balance_due > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setSelectedPayInvoice(inv)}
                            title="PayPal Checkout"
                            className="px-2.5 py-1 bg-[#0070BA] hover:bg-[#003087] text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Checkout</span>
                          </button>
                        )}

                        {/* Reminder action */}
                        {inv.balance_due > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => setSelectedReminderInvoice(inv)}
                            title="Prepare Payment Reminder"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                          >
                            <BellRing className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* View link */}
                        <Link
                          to={`/invoices/${inv.id}`}
                          title="View Invoice Details"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>

                        {/* Cancel action */}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleCancel(inv.id)}
                            title="Cancel Invoice"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <PayPalModal
        isOpen={!!selectedPayInvoice}
        onClose={() => setSelectedPayInvoice(null)}
        invoice={selectedPayInvoice}
        onPaymentSuccess={fetchInvoices}
      />
      <ReminderModal
        isOpen={!!selectedReminderInvoice}
        onClose={() => setSelectedReminderInvoice(null)}
        invoice={selectedReminderInvoice}
        onReminderSent={fetchInvoices}
      />
    </div>
  );
};
