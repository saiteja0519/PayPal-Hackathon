export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'initiated' | 'pending' | 'completed' | 'failed' | 'refunded';
export type ReminderStatus = 'draft' | 'scheduled' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  currency: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  owner_id: string;
  role: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  invoice_count: number;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  refunded_amount: number;
  balance_due: number;
  notes?: string;
  terms?: string;
  created_at: string;
  updated_at: string;
  items: InvoiceItem[];
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  invoice_number?: string;
  customer_name?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  provider: string;
  provider_order_id?: string;
  provider_capture_id?: string;
  provider_status?: string;
  refund_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  business_id: string;
  invoice_id: string;
  invoice_number?: string;
  customer_id: string;
  customer_name?: string;
  channel: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: ReminderStatus;
  sent_at?: string;
  error_message?: string;
  created_at: string;
}

export interface DashboardSummary {
  currency: string;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  overdue_balance: number;
  unpaid_invoices_count: number;
  overdue_invoices_count: number;
  paid_invoices_count: number;
  total_customers_count: number;
  status_distribution: Record<string, number>;
  recent_invoices: Invoice[];
  recent_payments: Payment[];
}

export interface MonthlyDataPoint {
  month: string;
  invoiced: number;
  paid: number;
  count_invoices: number;
  count_payments: number;
}

export interface AgingBucket {
  range: string;
  amount: number;
  invoice_count: number;
}

export interface AgingReport {
  currency: string;
  buckets: AgingBucket[];
  total_outstanding: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: string;
  tool_results?: string;
  created_at: string;
}

export interface AIChatResponse {
  conversation_id: string;
  reply: string;
  tools_executed: string[];
  tool_results: any[];
  provider: string;
  configured: boolean;
}
