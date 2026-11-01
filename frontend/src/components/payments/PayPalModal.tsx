import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Invoice } from '../../types';
import { invoicesAPI, paymentsAPI } from '../../services/api';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

interface PayPalModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onPaymentSuccess: () => void;
}

export const PayPalModal: React.FC<PayPalModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) => {
  const [step, setStep] = useState<'review' | 'initiating' | 'approved' | 'capturing' | 'success' | 'error'>('review');
  const [payAmount, setPayAmount] = useState<string>('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [captureResult, setCaptureResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!invoice) return null;

  const currentPayable = Number(invoice.balance_due);
  const initialAmount = payAmount ? parseFloat(payAmount) : currentPayable;

  const handleInitiateOrder = async () => {
    try {
      setStep('initiating');
      setErrorMessage('');
      const amountToPay = payAmount ? parseFloat(payAmount) : undefined;
      const res = await invoicesAPI.checkout(invoice.id, {
        amount: amountToPay,
        idempotency_key: `client-${invoice.id}-${Date.now()}`,
      });
      setPaymentData(res.data);
      setStep('approved');
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.response?.data?.detail || 'Failed to initiate PayPal Checkout session.');
    }
  };

  const handleCaptureOrder = async () => {
    if (!paymentData?.payment_id) return;
    try {
      setStep('capturing');
      setErrorMessage('');
      const res = await paymentsAPI.capture(paymentData.payment_id);
      setCaptureResult(res.data);
      setStep('success');
      onPaymentSuccess();
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.response?.data?.detail || 'Payment capture failed.');
    }
  };

  const handleClose = () => {
    setStep('review');
    setPayAmount('');
    setPaymentData(null);
    setCaptureResult(null);
    setErrorMessage('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="PayPal Sandbox Checkout"
      subtitle={`Invoice ${invoice.invoice_number} • ${invoice.customer_name}`}
      maxWidth="lg"
    >
      {step === 'review' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
              <span>Total Invoice Amount:</span>
              <span className="font-semibold text-slate-900 font-mono">
                {invoice.currency} {Number(invoice.total_amount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
              <span>Previously Paid:</span>
              <span className="text-emerald-600 font-mono">
                {invoice.currency} {Number(invoice.paid_amount).toFixed(2)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base font-bold text-slate-900">
              <span>Remaining Balance Due:</span>
              <span className="text-indigo-600 font-mono">
                {invoice.currency} {currentPayable.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Payment Amount ({invoice.currency})
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={currentPayable}
                placeholder={currentPayable.toFixed(2)}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-900 font-mono"
              />
              <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium py-1">
                Full Balance: {invoice.currency} {currentPayable.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Leave blank to charge the full outstanding balance of {invoice.currency} {currentPayable.toFixed(2)}.
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-800">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              PayPal Sandbox environment active. No real credit card or funds will be debited.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInitiateOrder}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <span>Continue to PayPal Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'initiating' && (
        <div className="text-center py-10">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <h4 className="text-base font-semibold text-slate-900">Creating PayPal Sandbox Order...</h4>
          <p className="text-xs text-slate-500 mt-1">
            Establishing secure encrypted handshake with PayPal Orders API.
          </p>
        </div>
      )}

      {step === 'approved' && paymentData && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <p className="font-semibold flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              PayPal Sandbox Approval Session
            </p>
            <p className="text-xs text-amber-800">
              PayPal Order ID: <code className="font-mono font-bold">{paymentData.paypal_order_id}</code>
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Authorized Amount:{' '}
              <span className="font-bold font-mono">
                {paymentData.currency} {Number(paymentData.amount).toFixed(2)}
              </span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <p className="text-xs text-slate-600 mb-3">
              In live checkout, the customer logs into PayPal or enters their card. Click below to simulate customer approval and trigger server-side capture:
            </p>
            <button
              onClick={handleCaptureOrder}
              className="w-full py-3 bg-[#FFC439] hover:bg-[#F2BA36] text-[#003087] font-bold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <span>Simulate PayPal Approval & Capture</span>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel Payment
            </button>
          </div>
        </div>
      )}

      {step === 'capturing' && (
        <div className="text-center py-10">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <h4 className="text-base font-semibold text-slate-900">Capturing & Reconciling Payment...</h4>
          <p className="text-xs text-slate-500 mt-1">
            Executing server-side order capture and recalculating invoice balances.
          </p>
        </div>
      )}

      {step === 'success' && captureResult && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Payment Successfully Captured!</h4>
          <p className="text-sm text-slate-600 mt-1 mb-4">
            Reconciled {captureResult.currency} {Number(captureResult.amount_captured).toFixed(2)} via PayPal Sandbox.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 max-w-sm mx-auto mb-6">
            <div className="flex justify-between">
              <span className="text-slate-500">Capture ID:</span>
              <span className="font-mono text-slate-900 font-semibold">{captureResult.paypal_capture_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">New Invoice Balance:</span>
              <span className="font-mono text-indigo-600 font-bold">
                {captureResult.currency} {Number(captureResult.new_invoice_balance).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice Status:</span>
              <span className="capitalize font-semibold text-slate-900">{captureResult.new_invoice_status}</span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm"
          >
            Done
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Payment Failed</h4>
          <p className="text-sm text-slate-600 mt-1 mb-6 max-w-sm mx-auto">
            {errorMessage || 'An error occurred during payment processing.'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={() => setStep('review')}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
