import axios from 'axios';
import {
  Customer,
  Invoice,
  Payment,
  Reminder,
  DashboardSummary,
  MonthlyDataPoint,
  AgingReport,
  AIChatResponse,
  Business,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('paypilot_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('paypilot_token');
      localStorage.removeItem('paypilot_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateBusiness: (data: any) => api.patch('/auth/business', data),
};

export const dashboardAPI = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),
  getMonthlySummary: () => api.get<{ currency: string; data: MonthlyDataPoint[] }>('/dashboard/monthly-summary'),
};

export const customersAPI = {
  list: (search?: string) => api.get<Customer[]>('/customers', { params: { search } }),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (data: any) => api.post<Customer>('/customers', data),
  update: (id: string, data: any) => api.patch<Customer>(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
};

export const invoicesAPI = {
  list: (params?: { status?: string; customer_id?: string; is_overdue?: boolean; search?: string }) =>
    api.get<Invoice[]>('/invoices', { params }),
  get: (id: string) => api.get<Invoice>(`/invoices/${id}`),
  create: (data: any) => api.post<Invoice>('/invoices', data),
  update: (id: string, data: any) => api.patch<Invoice>(`/invoices/${id}`, data),
  issue: (id: string) => api.post<Invoice>(`/invoices/${id}/issue`),
  cancel: (id: string) => api.post<Invoice>(`/invoices/${id}/cancel`),
  checkout: (id: string, data?: { amount?: number; idempotency_key?: string }) =>
    api.post<{
      payment_id: string;
      invoice_id: string;
      paypal_order_id: string;
      approval_url?: string;
      amount: number;
      currency: string;
      status: string;
    }>(`/invoices/${id}/checkout`, data || {}),
  draftReminder: (id: string, data: { tone?: string; custom_note?: string }) =>
    api.post<{
      invoice_id: string;
      customer_id: string;
      customer_name: string;
      recipient_email: string;
      subject: string;
      body: string;
      amount_due: number;
      currency: string;
      days_overdue: number;
    }>(`/invoices/${id}/reminders/draft`, data),
  sendReminder: (id: string, data: { subject: string; body: string; recipient_email?: string; simulate?: boolean }) =>
    api.post<Reminder>(`/invoices/${id}/reminders/send`, data),
};

export const paymentsAPI = {
  list: (params?: { status?: string }) => api.get<Payment[]>('/payments', { params }),
  get: (id: string) => api.get<Payment>(`/payments/${id}`),
  capture: (paymentId: string) =>
    api.post<{
      payment_id: string;
      invoice_id: string;
      paypal_order_id: string;
      paypal_capture_id?: string;
      status: string;
      amount_captured: number;
      currency: string;
      new_invoice_balance: number;
      new_invoice_status: string;
      message: string;
    }>(`/payments/${paymentId}/capture`),
};

export const aiAPI = {
  chat: (data: { message: string; conversation_id?: string }) =>
    api.post<AIChatResponse>('/ai/chat', data),
  listConversations: () => api.get('/ai/conversations'),
  getConversation: (id: string) => api.get(`/ai/conversations/${id}`),
};

export const remindersAPI = {
  list: (params?: { status?: string }) => api.get<Reminder[]>('/reminders', { params }),
  get: (id: string) => api.get<Reminder>(`/reminders/${id}`),
};

export const analyticsAPI = {
  getOverview: () => api.get<DashboardSummary>('/analytics/overview'),
  getAging: () => api.get<AgingReport>('/analytics/aging'),
  exportCSVUrl: '/api/analytics/export',
};

export default api;
