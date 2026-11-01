import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { remindersAPI } from '../services/api';
import { Reminder } from '../types';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import {
  BellRing,
  Mail,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const RemindersPage: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const res = await remindersAPI.list();
      setReminders(res.data);
    } catch (err) {
      console.error('Failed to load reminders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Reminders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of customer payment reminders, delivery channels, and follow-up history.
          </p>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-800">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Multi-tone automated drafting with user authorization gate.</span>
        </div>
      </div>

      {/* Reminders Table */}
      <Card>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading reminder records...</p>
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No reminders dispatched yet"
            description="When you follow up on overdue or upcoming invoices, reminders will be logged here."
          />
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-3">Dispatched At</th>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Subject Line</th>
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">View Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reminders.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 text-slate-500">
                      {r.sent_at
                        ? new Date(r.sent_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Draft'}
                    </td>
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-900">
                      <Link to={`/invoices/${r.invoice_id}`} className="hover:text-indigo-600">
                        {r.invoice_number || 'View Invoice'}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      <div>{r.customer_name}</div>
                      <div className="text-[11px] text-slate-400">{r.recipient_email}</div>
                    </td>
                    <td className="px-6 py-3.5 text-slate-700 max-w-xs truncate">{r.subject}</td>
                    <td className="px-6 py-3.5">
                      <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {r.channel}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge status={r.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedReminder(r)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                        title="Read message content"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Message Preview Modal */}
      <Modal
        isOpen={!!selectedReminder}
        onClose={() => setSelectedReminder(null)}
        title="Payment Reminder Details"
        subtitle={selectedReminder ? `To: ${selectedReminder.recipient_email}` : ''}
        maxWidth="lg"
      >
        {selectedReminder && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-500">Subject:</span>{' '}
                <span className="text-slate-900 font-medium">{selectedReminder.subject}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Channel:</span>{' '}
                <span className="capitalize">{selectedReminder.channel}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Status:</span>{' '}
                <Badge status={selectedReminder.status} size="sm" />
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Delivered Message Body
              </span>
              <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto">
                {selectedReminder.body}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedReminder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
