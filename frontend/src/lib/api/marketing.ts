const API_BASE = process.env.NEXT_PUBLIC_API || process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

export interface MarketingSettings {
  configured: boolean;
  email?: string;
  fromName?: string;
  updatedAt?: string;
}

export interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  consentSource: string;
  consentedAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

export interface MarketingLeadsResponse {
  leads: MarketingLead[];
  total: number;
  subscribedCount: number;
}

export interface MarketingCampaign {
  id: string;
  mailType: 'CAMPAIGN' | 'DIRECT_MAIL' | string;
  subject: string;
  status: 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED' | string;
  attachmentNames: string[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  nextBatchAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MarketingCampaignRecipient {
  id: string;
  email: string;
  status: string;
  error: string | null;
  sentAt: string | null;
}

export interface MarketingDirectMailRecipient {
  id: string | null;
  email: string;
  name: string | null;
  isNew: boolean;
}

export interface MarketingDirectMailPreview {
  recipients: MarketingDirectMailRecipient[];
  rejected: { email: string; reason: string }[];
  recipientCount: number;
}

export interface MarketingImportResult {
  imported: number;
  duplicatesSkipped: number;
  invalidRows: number;
  errors: string[];
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(!isFormData && init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(typeof payload?.message === 'string' ? payload.message : 'Marketing request failed.');
  }
  return payload?.data as T;
}

export const getMarketingSettings = (token: string | null) =>
  request<MarketingSettings>('/marketing/settings', token);

export const saveMarketingSettings = (token: string | null, input: { email: string; fromName: string; appPassword: string }) =>
  request<MarketingSettings>('/marketing/settings', token, { method: 'PUT', body: JSON.stringify(input) });

export const listMarketingLeads = (token: string | null) =>
  request<MarketingLeadsResponse>('/marketing/leads', token);

export const addMarketingLead = (token: string | null, input: { email: string; name: string; consent: boolean; consentSource: string }) =>
  request<MarketingLead>('/marketing/leads', token, { method: 'POST', body: JSON.stringify(input) });

export const importMarketingLeads = (token: string | null, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return request<MarketingImportResult>('/marketing/leads/import', token, { method: 'POST', body: form });
};

export const listMarketingCampaigns = (token: string | null) =>
  request<MarketingCampaign[]>('/marketing/campaigns', token);

export const listMarketingCampaignRecipients = (token: string | null, campaignId: string) =>
  request<MarketingCampaignRecipient[]>(`/marketing/campaigns/${encodeURIComponent(campaignId)}/recipients`, token);

const campaignForm = (input: { to?: string; subject: string; body: string; confirmRecipientCount?: number; attachments: File[] }) => {
  const form = new FormData();
  if (input.to) form.append('to', input.to);
  form.append('subject', input.subject);
  form.append('body', input.body);
  if (input.confirmRecipientCount !== undefined) form.append('confirmRecipientCount', String(input.confirmRecipientCount));
  input.attachments.forEach((file) => form.append('attachments', file));
  return form;
};

export const sendMarketingTest = (token: string | null, input: { to: string; subject: string; body: string; attachments: File[] }) =>
  request<{ sentTo: string }>('/marketing/campaigns/test', token, { method: 'POST', body: campaignForm(input) });

export const sendMarketingCampaign = (token: string | null, input: { subject: string; body: string; confirmRecipientCount: number; attachments: File[] }) =>
  request<MarketingCampaign>('/marketing/campaigns', token, { method: 'POST', body: campaignForm(input) });

export const previewMarketingDirectMailRecipients = (token: string | null, input: {
  emails?: string;
  file?: File;
  consentConfirmed: boolean;
  consentSource: string;
}) => {
  const form = new FormData();
  if (input.file) form.append('file', input.file);
  else form.append('emails', input.emails || '');
  form.append('consentConfirmed', String(input.consentConfirmed));
  form.append('consentSource', input.consentSource);
  return request<MarketingDirectMailPreview>('/marketing/direct-mails/recipients/preview', token, { method: 'POST', body: form });
};

export const sendMarketingDirectMail = (token: string | null, input: {
  recipientEmails: string[];
  confirmRecipientCount: number;
  consentConfirmed: boolean;
  consentSource: string;
  subject: string;
  body: string;
  attachments: File[];
}) => {
  const form = campaignForm({ subject: input.subject, body: input.body, attachments: input.attachments });
  form.append('recipientEmails', JSON.stringify(input.recipientEmails));
  form.append('confirmRecipientCount', String(input.confirmRecipientCount));
  form.append('consentConfirmed', String(input.consentConfirmed));
  form.append('consentSource', input.consentSource);
  return request<MarketingCampaign>('/marketing/direct-mails', token, { method: 'POST', body: form });
};

export const unsubscribeMarketingLead = (token: string) =>
  request<{ unsubscribed: boolean }>('/marketing/unsubscribe', null, { method: 'POST', body: JSON.stringify({ token }) });
