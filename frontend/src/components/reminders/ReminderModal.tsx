import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Invoice } from '../../types';
import { invoicesAPI } from '../../services/api';
import { Send, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onReminderSent: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onReminderSent,
}) => {
  const [tone, setTone] = useState<'polite' | 'firm' | 'urgent'>('polite');
  const [customNote, setCustomNote] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [loadingDraft, setLoadingDraft] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && invoice) {
      loadDraft();
    } else {
      setSuccess(false);
      setError('');
    }
  }, [isOpen, invoice, tone]);

  const loadDraft = async () => {
    if (!invoice) return;
    try {
      setLoadingDraft(true);
      setError('');
      const res = await invoicesAPI.draftReminder(invoice.id, {
        tone,
        custom_note: customNote || undefined,
      });
      setSubject(res.data.subject);
      setBody(res.data.body);
      setRecipient(res.data.recipient_email);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate reminder draft.');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    try {
      setSending(true);
      setError('');
      await invoicesAPI.sendReminder(invoice.id, {
        subject,
        body,
        recipient_email: recipient,
        simulate: true,
      });
      setSuccess(true);
      onReminderSent();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to dispatch reminder.');
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prepare Payment Reminder"
      subtitle={`Invoice ${invoice.invoice_number} • ${invoice.customer_name}`}
      maxWidth="xl"
    >
      {success ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Reminder Dispatched!</h4>
          <p className="text-sm text-slate-600 mt-1 mb-6">
            Payment reminder recorded and delivered to <span className="font-semibold">{recipient}</span>.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Select Tone
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['polite', 'firm', 'urgent'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border capitalize transition-all ${
                    tone === t
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loadingDraft}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Message Body
              </label>
              <button
                type="button"
                onClick={loadDraft}
                disabled={loadingDraft}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Regenerate Draft</span>
              </button>
            </div>
            {loadingDraft ? (
              <div className="py-12 text-center bg-slate-50 border border-slate-200 rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Drafting personalized reminder...</p>
              </div>
            ) : (
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-sans"
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || loadingDraft}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Approve & Send Reminder</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
