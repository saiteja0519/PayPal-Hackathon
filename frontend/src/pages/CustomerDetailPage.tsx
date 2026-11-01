import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { customersAPI, invoicesAPI } from '../services/api';
import { Customer, Invoice } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Plus,
  Receipt,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { business } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCustomerData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [cRes, invRes] = await Promise.all([
        customersAPI.get(id),
        invoicesAPI.list({ customer_id: id }),
      ]);
      setCustomer(cRes.data);
      setInvoices(invRes.data);
    } catch (err) {
      console.error('Failed to load customer details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading customer account...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-24">
        <p className="text-base font-semibold text-slate-800">Customer record not found</p>
        <Link to="/customers" className="text-xs text-indigo-600 underline mt-2 inline-block">
          Return to customer list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </Link>

        <Link
          to="/invoices/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Invoice for Customer</span>
        </Link>
      </div>

      {/* Customer Header Card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{customer.name}</h1>
            {customer.company_name && (
              <div className="text-sm text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{customer.company_name}</span>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{customer.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-center shrink-0">
            <div>
              <span className="text-slate-400 text-[11px] block">Invoiced</span>
              <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                {business?.currency} {Number(customer.total_invoiced).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Paid</span>
              <span className="font-mono font-bold text-emerald-600 mt-0.5 block">
                {business?.currency} {Number(customer.total_paid).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Outstanding</span>
              <span className="font-mono font-bold text-indigo-600 mt-0.5 block">
                {business?.currency} {Number(customer.outstanding_balance).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Customer Invoices */}
      <Card title="Invoice History" subtitle="All invoices issued to this client">
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No invoices issued to this customer yet.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-3">Invoice Number</th>
                  <th className="px-6 py-3">Issue Date</th>
                  <th className="px-6 py-3">Due Date</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Balance Due</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
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
                    <td className="px-6 py-3.5 text-slate-500">{inv.issue_date}</td>
                    <td className="px-6 py-3.5 text-slate-500">{inv.due_date}</td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-900">
                      {inv.currency} {Number(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      {inv.currency} {Number(inv.balance_due).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={inv.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View Details
                      </Link>
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
