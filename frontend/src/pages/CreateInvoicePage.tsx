import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { customersAPI, invoicesAPI } from '../services/api';
import { Customer } from '../types';
import { Card } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import {
  Plus,
  Trash2,
  ArrowLeft,
  Calendar,
  DollarSign,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';

interface LineItemForm {
  description: string;
  quantity: number;
  unit_price: number;
}

export const CreateInvoicePage: React.FC = () => {
  const { business } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [customerId, setCustomerId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const todayStr = new Date().toISOString().split('T')[0];
  const dueDefaultStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(dueDefaultStr);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('Thank you for your business. Please remit payment via PayPal Checkout.');
  const [terms, setTerms] = useState<string>('Payment due within terms specified on invoice.');

  const [items, setItems] = useState<LineItemForm[]>([
    { description: 'Professional Services', quantity: 1, unit_price: 500 },
  ]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await customersAPI.list();
        setCustomers(res.data);
        if (res.data.length > 0) {
          setCustomerId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load customers', err);
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof LineItemForm, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Live calculations
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const taxAmount = subtotal * ((taxRate || 0) / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerId) {
      setError('Please select or create a customer.');
      return;
    }
    if (dueDate < issueDate) {
      setError('Due date cannot precede the issue date.');
      return;
    }
    const invalidItem = items.find((it) => !it.description.trim() || it.quantity <= 0 || it.unit_price < 0);
    if (invalidItem) {
      setError('All items must have a valid description, quantity greater than 0, and non-negative price.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await invoicesAPI.create({
        customer_id: customerId,
        invoice_number: invoiceNumber.trim() || undefined,
        issue_date: issueDate,
        due_date: dueDate,
        currency: business?.currency || 'USD',
        tax_rate: taxRate,
        notes,
        terms,
        items,
      });
      navigate(`/invoices/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Invoices</span>
        </Link>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Create New Invoice</h1>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Date Card */}
        <Card title="Invoice Header & Recipient">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Customer
                </label>
                <Link to="/customers" className="text-xs text-indigo-600 hover:underline">
                  + Add New Customer
                </Link>
              </div>
              {loadingCustomers ? (
                <div className="py-2 text-xs text-slate-400">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200">
                  No customers found. Please{' '}
                  <Link to="/customers" className="font-semibold underline">
                    create a customer
                  </Link>{' '}
                  first.
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 bg-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Custom Invoice # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-0099 (Auto-generated if blank)"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>
          </div>
        </Card>

        {/* Line Items Card */}
        <Card title="Line Items & Pricing">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Quantity</div>
              <div className="col-span-2 text-right">Unit Price ({business?.currency})</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 p-2 rounded-lg border border-slate-200/80">
                <div className="col-span-6">
                  <input
                    type="text"
                    required
                    placeholder="Item or service description"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 text-right bg-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-900 text-right bg-white font-mono"
                  />
                </div>
                <div className="col-span-1 text-right font-mono font-semibold text-slate-900 text-xs">
                  {((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Item</span>
            </button>
          </div>

          {/* Totals Summary Area */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-end">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {business?.currency} {subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Tax Rate (%):</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded border border-slate-300 text-right font-mono text-xs outline-none"
                />
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax Amount:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {business?.currency} {taxAmount.toFixed(2)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Amount:</span>
                <span className="font-mono text-indigo-600">
                  {business?.currency} {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Notes & Terms */}
        <Card title="Notes & Terms">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Customer Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Payment Terms
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3">
          <Link
            to="/invoices"
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Invoice...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Draft Invoice</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
