import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, User, Shield, Info, CheckCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const businessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  tax_id: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
});

type BusinessFormData = z.infer<typeof businessSchema>;

export const SettingsPage: React.FC = () => {
  const { user, business } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: '',
      currency: 'INR',
      tax_id: '',
      address: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    if (business) {
      reset({
        name: (business as any).name ?? '',
        currency: (business as any).currency ?? 'INR',
        tax_id: (business as any).tax_id ?? '',
        address: (business as any).address ?? '',
        phone: (business as any).phone ?? '',
        email: (business as any).email ?? '',
      });
    }
  }, [business, reset]);

  const onSubmit = async (data: BusinessFormData) => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.patch('/auth/business', data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your business profile and account preferences</p>
      </div>

      {/* Business Profile */}
      <Card>
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-slate-800">Business Profile</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Your Business Name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                {...register('currency')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="INR">INR – Indian Rupee</option>
                <option value="USD">USD – US Dollar</option>
                <option value="EUR">EUR – Euro</option>
                <option value="GBP">GBP – British Pound</option>
                <option value="AUD">AUD – Australian Dollar</option>
              </select>
              {errors.currency && <p className="text-red-500 text-xs mt-1">{errors.currency.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID / GST Number</label>
              <input
                {...register('tax_id')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. 22AAAAA0000A1Z5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Email</label>
              <input
                {...register('email')}
                type="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="contact@yourbusiness.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                {...register('phone')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                {...register('address')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Business profile updated successfully.
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>

      {/* Account Info */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-slate-800">Account Information</h2>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
            <span className="text-slate-500">Full Name</span>
            <span className="text-slate-800 font-medium">{user?.full_name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-800 font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-slate-500">Member Since</span>
            <span className="text-slate-800 font-medium">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* System Status */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-slate-800">System Status</h2>
        </div>
        <div className="space-y-1 text-sm">
          {[
            {
              label: 'Payment Mode',
              badge: 'PayPal Sandbox (Mock)',
              color: 'yellow',
            },
            {
              label: 'AI Assistant',
              badge: 'Deterministic Engine (Active)',
              color: 'green',
            },
            {
              label: 'Email Reminders',
              badge: 'Simulated (No SMTP)',
              color: 'blue',
            },
            {
              label: 'Database',
              badge: 'SQLite (Development)',
              color: 'indigo',
            },
          ].map(({ label, badge, color }) => {
            const cls: Record<string, string> = {
              yellow: 'bg-yellow-100 text-yellow-800',
              green: 'bg-green-100 text-green-800',
              blue: 'bg-blue-100 text-blue-800',
              indigo: 'bg-indigo-100 text-indigo-800',
            };
            const dot: Record<string, string> = {
              yellow: 'bg-yellow-500',
              green: 'bg-green-500',
              blue: 'bg-blue-500',
              indigo: 'bg-indigo-500',
            };
            return (
              <div
                key={label}
                className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-500">{label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cls[color]}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot[color]}`} />
                  {badge}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-blue-700">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            This is a development/demo build. PayPal payments use Sandbox credentials — no real money is
            processed. To enable live LLM, SMTP, or production PayPal, update the{' '}
            <code className="bg-blue-100 px-1 rounded">.env</code> file and restart the backend.
          </p>
        </div>
      </Card>
    </div>
  );
}
