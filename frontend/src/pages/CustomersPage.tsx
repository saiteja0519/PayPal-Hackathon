import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { customersAPI } from '../services/api';
import { Customer } from '../types';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { business } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Customer Form state
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await customersAPI.list(search || undefined);
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      setSaving(true);
      await customersAPI.create({
        name,
        email,
        company_name: companyName || undefined,
        phone: phone || undefined,
        address: address || undefined,
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setCompanyName('');
      setPhone('');
      setAddress('');
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your client contacts, invoicing history, and outstanding balances.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="max-w-md relative">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 bg-white"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
      </form>

      {/* Customers List Card */}
      <Card>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your client records to start issuing invoices and tracking payments."
            actionLabel="Add Customer"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-3">Customer / Company</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3 text-right">Invoiced</th>
                  <th className="px-6 py-3 text-right">Paid</th>
                  <th className="px-6 py-3 text-right">Outstanding</th>
                  <th className="px-6 py-3 text-center">Invoices</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/customers/${c.id}`}
                        className="font-semibold text-slate-900 hover:text-indigo-600 text-sm block"
                      >
                        {c.name}
                      </Link>
                      {c.company_name && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{c.company_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.email}</span>
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-medium text-slate-900">
                      {business?.currency} {Number(c.total_invoiced).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-emerald-600 font-medium">
                      {business?.currency} {Number(c.total_paid).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                      {business?.currency} {Number(c.outstanding_balance).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-center font-medium text-slate-700">
                      {c.invoice_count}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/customers/${c.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Customer"
        subtitle="Create a client record for invoicing and payment tracking"
      >
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Customer / Contact Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corporation or Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Billing Email *
            </label>
            <input
              type="email"
              required
              placeholder="billing@customer.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Company Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Acme Global Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Billing Address
            </label>
            <textarea
              rows={2}
              placeholder="123 Street Name, City, State, Country"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Save Customer</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
