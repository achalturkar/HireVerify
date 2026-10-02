import type { Client } from '@/src/types/client';

const API_BASE = process.env.NEXT_PUBLIC_API ?? '/api/v1';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
export type InvoiceAmount = number | string;

export interface InvoiceProfile {
  id: string;
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string;
  gstNumber: string;
  panNumber: string;
  city: string;
  country: string;
  state: string;
  postalCode: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfscCode: string;
  bankSwiftCode: string;
  bankBranch: string;
  upiId: string;
}

export interface InvoiceCase {
  id: string;
  caseNumber: string;
  status: string;
  packageName: string | null;
  candidateName: string;
  candidate: { firstName: string; lastName: string; candidateCode: string };
}

export interface InvoiceItemInput {
  caseId?: string;
  description: string;
  candidateName?: string;
  serviceCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

export interface InvoiceInput {
  clientId: string;
  clientAddress?: string;
  clientGst?: string;
  clientPan?: string;
  clientState?: string;
  clientEmail?: string;
  clientContactName?: string;
  clientPhone?: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  placeOfSupply?: string;
  purchaseOrderNumber?: string;
  notes?: string;
  terms?: string;
  items: InvoiceItemInput[];
}

export interface InvoiceItem extends InvoiceItemInput {
  id: string;
  subtotal: InvoiceAmount;
  discountAmount: InvoiceAmount;
  taxableAmount: InvoiceAmount;
  taxAmount: InvoiceAmount;
  total: InvoiceAmount;
}

export interface InvoicePayment {
  id: string;
  amount: InvoiceAmount;
  paymentDate: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InvoiceActivity {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  clientAddress: string | null;
  clientGst: string | null;
  clientPan: string | null;
  clientState: string | null;
  clientEmail: string | null;
  clientContactName: string | null;
  clientPhone: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierGst: string | null;
  supplierPan: string | null;
  supplierState: string | null;
  supplierCity: string | null;
  supplierPostalCode: string | null;
  supplierEmail: string | null;
  supplierPhone: string | null;
  supplierLogoUrl: string | null;
  supplierPrimaryColor: string | null;
  supplierSignatureUrl: string | null;
  supplierAdminName: string | null;
  supplierBankAccountName: string | null;
  supplierBankName: string | null;
  supplierBankAccountNumber: string | null;
  supplierBankIfscCode: string | null;
  supplierBankSwiftCode: string | null;
  supplierBankBranch: string | null;
  supplierUpiId: string | null;
  placeOfSupply: string | null;
  taxType: string;
  currency: string;
  purchaseOrderNumber: string | null;
  subtotal: InvoiceAmount;
  discountTotal: InvoiceAmount;
  taxTotal: InvoiceAmount;
  total: InvoiceAmount;
  amountPaid: InvoiceAmount;
  balanceDue: InvoiceAmount;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  activity: InvoiceActivity[];
  createdAt: string;
}

export interface InvoiceSummary {
  total: number;
  drafts: number;
  paid: number;
  overdue: number;
  outstanding: number;
}

export interface InvoiceAnalytics {
  currencies: Array<{
    currency: string;
    billed: number;
    collected: number;
    outstanding: number;
    monthly: Array<{ key: string; label: string; billed: number; collected: number }>;
  }>;
  statusMix: Array<{ status: InvoiceStatus; count: number }>;
  topClients: Array<{ currency: string; name: string; billed: number; invoices: number }>;
}

export type InvoiceClient = Pick<Client, 'id' | 'name' | 'contactEmail' | 'gstNumber' | 'panNumber' | 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'country' | 'postalCode'>;

export class InvoiceApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  if (!token) throw new InvoiceApiError('You must be signed in to do this.', 401);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const message = body?.message?.message || body?.message || `Request failed (${response.status})`;
    throw new InvoiceApiError(typeof message === 'string' ? message : 'Invoice request failed.', response.status);
  }
  return body.data as T;
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function getInvoiceProfile(token: string | null): Promise<InvoiceProfile> {
  const result = await request<{ data: InvoiceProfile }>('/invoices/profile', token);
  return result.data;
}

export async function saveInvoiceProfile(profile: Omit<InvoiceProfile, 'id' | 'name' | 'logoUrl' | 'email' | 'phone'>, token: string | null): Promise<InvoiceProfile> {
  const result = await request<{ data: InvoiceProfile }>('/invoices/profile', token, { method: 'PUT', body: JSON.stringify(profile) });
  return result.data;
}

export async function listInvoiceCases(clientId: string, token: string | null): Promise<InvoiceCase[]> {
  const result = await request<{ data: InvoiceCase[] }>(`/invoices/cases${query({ clientId })}`, token);
  return result.data;
}

export interface InvoiceListParams {
  page: number;
  limit: number;
  search?: string;
  status?: InvoiceStatus | '';
  clientId?: string;
  companyId?: string;
  currency?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface InvoiceListResult {
  items: Invoice[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  summary: InvoiceSummary;
  analytics: InvoiceAnalytics;
}

async function fetchInvoiceList(path: string, params: InvoiceListParams, token: string | null): Promise<InvoiceListResult> {
  const result = await request<{ data: Invoice[]; meta: InvoiceListResult['meta']; summary: InvoiceSummary; analytics: InvoiceAnalytics }>(
    `${path}${query({ ...params })}`,
    token,
  );
  return { items: result.data, meta: result.meta, summary: result.summary, analytics: result.analytics };
}

export function listInvoices(params: InvoiceListParams, token: string | null): Promise<InvoiceListResult> {
  return fetchInvoiceList('/invoices', params, token);
}

export function listPlatformInvoices(params: InvoiceListParams, token: string | null): Promise<InvoiceListResult> {
  return fetchInvoiceList('/invoices/platform', params, token);
}

export async function createInvoice(payload: InvoiceInput, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>('/invoices', token, { method: 'POST', body: JSON.stringify(payload) });
  return result.data;
}

export async function updateInvoice(id: string, payload: InvoiceInput, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}`, token, { method: 'PUT', body: JSON.stringify(payload) });
  return result.data;
}

export async function deleteInvoice(id: string, token: string | null): Promise<void> {
  await request(`/invoices/${id}`, token, { method: 'DELETE' });
}

export async function getInvoice(id: string, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}`, token);
  return result.data;
}

async function fetchPdf(path: string, token: string | null): Promise<Blob> {
  if (!token) throw new InvoiceApiError('You must be signed in to do this.', 401);
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new InvoiceApiError('Could not generate the invoice PDF.', response.status);
  return response.blob();
}

export function downloadInvoicePdf(id: string, token: string | null): Promise<Blob> { return fetchPdf(`/invoices/${id}/pdf`, token); }
export function previewInvoicePdf(id: string, token: string | null): Promise<Blob> { return fetchPdf(`/invoices/${id}/pdf`, token); }

export async function emailInvoice(id: string, email: string, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}/send`, token, { method: 'POST', body: JSON.stringify({ email }) });
  return result.data;
}

export async function recordInvoicePayment(id: string, payment: { amount: number; paymentDate: string; method: string; reference?: string }, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}/payments`, token, { method: 'POST', body: JSON.stringify(payment) });
  return result.data;
}

export async function voidInvoice(id: string, token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}/void`, token, { method: 'POST', body: JSON.stringify({}) });
  return result.data;
}

export async function changeInvoiceStatus(id: string, status: 'SENT', token: string | null): Promise<Invoice> {
  const result = await request<{ data: Invoice }>(`/invoices/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) });
  return result.data;
}