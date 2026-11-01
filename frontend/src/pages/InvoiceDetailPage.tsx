import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { invoicesAPI, paymentsAPI } from '../services/api';
import { Invoice, Payment } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PayPalModal } from '../components/payments/PayPalModal';
import { ReminderModal } from '../components/reminders/ReminderModal';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft,
  CreditCard,
  BellRing,
  Send,
  XCircle,
  Printer,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  Building2,
} from 'lucide-react';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showReminderModal, setShowReminderModal] = useState<boolean>(false);

  const fetchInvoiceData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await invoicesAPI.get(id);
      setInvoice(res.data);

      const payRes = await paymentsAPI.list();
      setPayments(payRes.data.filter((p) => p.invoice_id === id));
    } catch (err) {
      console.error('Failed to load invoice details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  const handleIssue = async () => {
    if (!id) return;
    try {
      await invoicesAPI.issue(id);
      fetchInvoiceData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to issue invoice.');
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      await invoicesAPI.cancel(id);
      fetchInvoiceData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to cancel invoice.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-24">
        <p className="text-base font-semibold text-slate-800">Invoice not found</p>
        <Link to="/invoices" className="text-xs text-indigo-600 underline mt-2 inline-block">
          Return to invoice list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </Link>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'draft' && (
            <button
              onClick={handleIssue}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Issue to Client</span>
            </button>
          )}

          {invoice.balance_due > 0 && invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-1.5 bg-[#0070BA] hover:bg-[#003087] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>PayPal Checkout</span>
            </button>
          )}

          {invoice.balance_due > 0 && invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setShowReminderModal(true)}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Draft Reminder</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            title="Print Invoice"
          >
            <Printer className="w-4 h-4" />
          </button>

          {invoice.status === 'draft' && (
            <button
              onClick={handleCancel}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
              title="Cancel Invoice"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Invoice Document Box */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 sm:p-10 space-y-8 print:border-none print:shadow-none">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{business?.name}</div>
            <div className="text-xs text-slate-500 mt-1 max-w-xs">{business?.address || 'Primary Business Address'}</div>
            {business?.tax_id && (
              <div className="text-xs text-slate-400 mt-0.5">Tax ID: {business.tax_id}</div>
            )}
          </div>

          <div className="text-left sm:text-right">
            <div className="text-2xl font-bold font-mono text-slate-900">{invoice.invoice_number}</div>
            <div className="mt-1">
              <Badge status={invoice.status} />
            </div>
            <div className="mt-3 text-xs text-slate-500 space-y-1">
              <div>
                <span className="text-slate-400">Issue Date:</span>{' '}
                <span className="font-semibold text-slate-700">{invoice.issue_date}</span>
              </div>
              <div>
                <span className="text-slate-400">Due Date:</span>{' '}
                <span className={`font-semibold ${invoice.status === 'overdue' ? 'text-rose-600' : 'text-slate-700'}`}>
                  {invoice.due_date}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <span className="font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Billed To
            </span>
            <div className="text-sm font-bold text-slate-900">{invoice.customer_name}</div>
            <div className="text-slate-600 mt-0.5">{invoice.customer_email}</div>
          </div>

          <div className="sm:text-right">
            <span className="font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Payment Terms & Currency
            </span>
            <div className="text-xs text-slate-700 font-mono font-medium">Currency: {invoice.currency}</div>
            <div className="text-xs text-slate-500 mt-0.5">Payment Method: PayPal Checkout Sandbox</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5">Item Description</th>
                <th className="py-2.5 text-right">Qty</th>
                <th className="py-2.5 text-right">Unit Price</th>
                <th className="py-2.5 text-right">Amount ({invoice.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {invoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 font-medium text-slate-900">{item.description}</td>
                  <td className="py-3 text-right font-mono">{Number(item.quantity).toFixed(2)}</td>
                  <td className="py-3 text-right font-mono">{Number(item.unit_price).toFixed(2)}</td>
                  <td className="py-3 text-right font-mono font-semibold text-slate-900">
                    {Number(item.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="flex flex-col items-end pt-4 border-t border-slate-100">
          <div className="w-72 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-slate-900">
                {invoice.currency} {Number(invoice.subtotal).toFixed(2)}
              </span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({invoice.tax_rate}%):</span>
                <span className="font-mono font-semibold text-slate-900">
                  {invoice.currency} {Number(invoice.tax_amount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-sm">
              <span>Total Invoice Amount:</span>
              <span className="font-mono">
                {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Confirmed Paid:</span>
              <span className="font-mono">
                -{invoice.currency} {Number(invoice.paid_amount).toFixed(2)}
              </span>
            </div>
            {invoice.pending_amount > 0 && (
              <div className="flex justify-between text-amber-600 font-medium">
                <span>Pending PayPal Capture:</span>
                <span className="font-mono">
                  {invoice.currency} {Number(invoice.pending_amount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-indigo-600 font-bold text-base border-t border-slate-200 pt-2">
              <span>Balance Due:</span>
              <span className="font-mono">
                {invoice.currency} {Number(invoice.balance_due).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500">
            {invoice.notes && (
              <div>
                <span className="font-semibold uppercase tracking-wider text-slate-400 block mb-1">Notes</span>
                <p>{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <span className="font-semibold uppercase tracking-wider text-slate-400 block mb-1">Terms</span>
                <p>{invoice.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment History Card */}
      <Card title="Payment & Reconciliation History" subtitle="PayPal transaction logs and audit trail">
        {payments.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No payments recorded yet for this invoice.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-2.5">Date</th>
                  <th className="px-6 py-2.5">Provider Order ID</th>
                  <th className="px-6 py-2.5">Capture ID</th>
                  <th className="px-6 py-2.5 text-right">Amount</th>
                  <th className="px-6 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-800">{p.provider_order_id || 'N/A'}</td>
                    <td className="px-6 py-3 font-mono text-slate-800">{p.provider_capture_id || 'N/A'}</td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-slate-900">
                      {p.currency} {Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge status={p.status} size="sm" />
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
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        invoice={invoice}
        onPaymentSuccess={fetchInvoiceData}
      />
      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        invoice={invoice}
        onReminderSent={fetchInvoiceData}
      />
    </div>
  );
};
