'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle, CheckCircle2, Eye, FileUp, Mail, Megaphone, Plus, RefreshCw, Send, Settings2, Users, X,
} from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import {
  addMarketingLead, getMarketingSettings, importMarketingLeads, listMarketingCampaignRecipients, listMarketingCampaigns,
  listMarketingLeads, previewMarketingDirectMailRecipients, saveMarketingSettings, sendMarketingCampaign,
  sendMarketingDirectMail, sendMarketingTest,
} from '@/src/lib/api/marketing';
import type {
  MarketingCampaign, MarketingCampaignRecipient, MarketingDirectMailPreview, MarketingImportResult,
  MarketingLead, MarketingSettings,
} from '@/src/lib/api/marketing';

const inputClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-[var(--muted)]';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const emptySettings: MarketingSettings = { configured: false };

export default function MarketingPage() {
  const { accessToken, permissions } = useAuth();
  const canManage = permissions.includes('marketing.manage');
  const canSend = permissions.includes('marketing.send');
  const [activeTab, setActiveTab] = useState<'campaign' | 'direct' | 'leads' | 'sender' | 'history'>('campaign');
  const [settings, setSettings] = useState<MarketingSettings>(emptySettings);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [recipientCampaignId, setRecipientCampaignId] = useState('');
  const [recipientRows, setRecipientRows] = useState<MarketingCampaignRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({ email: '', fromName: '', appPassword: '' });
  const [leadDraft, setLeadDraft] = useState({ email: '', name: '', consentSource: '' });
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [importResult, setImportResult] = useState<MarketingImportResult | null>(null);
  const [testTo, setTestTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [directEmailsDraft, setDirectEmailsDraft] = useState('');
  const [directRecipients, setDirectRecipients] = useState<MarketingDirectMailPreview | null>(null);
  const [directConsentConfirmed, setDirectConsentConfirmed] = useState(false);
  const [directConsentSource, setDirectConsentSource] = useState('');
  const [directSubject, setDirectSubject] = useState('');
  const [directBody, setDirectBody] = useState('');
  const [directAttachments, setDirectAttachments] = useState<File[]>([]);

  const loadWorkspace = useCallback(() => Promise.all([
    getMarketingSettings(accessToken),
    listMarketingLeads(accessToken),
    listMarketingCampaigns(accessToken),
  ]), [accessToken]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [settingsResult, leadResult, campaignResult] = await loadWorkspace();
      setSettings(settingsResult);
      setSettingsDraft((current) => ({ ...current, email: settingsResult.email || '', fromName: settingsResult.fromName || '' }));
      setLeads(leadResult.leads);
      setSubscribedCount(leadResult.subscribedCount);
      setTotalLeadCount(leadResult.total);
      setCampaigns(campaignResult);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load Marketing.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadWorkspace()
      .then(([settingsResult, leadResult, campaignResult]) => {
        if (!active) return;
        setSettings(settingsResult);
        setSettingsDraft((current) => ({ ...current, email: settingsResult.email || '', fromName: settingsResult.fromName || '' }));
        setLeads(leadResult.leads);
        setSubscribedCount(leadResult.subscribedCount);
        setTotalLeadCount(leadResult.total);
        setCampaigns(campaignResult);
      })
      .catch((error: unknown) => {
        if (active) setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load Marketing.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadWorkspace]);

  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.status === 'SENDING')) return undefined;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [campaigns]);

  useEffect(() => {
    if (!campaigns.some((campaign) => campaign.status === 'SENDING')) return undefined;
    let active = true;
    const timer = window.setInterval(() => {
      listMarketingCampaigns(accessToken)
        .then((updated) => { if (active) setCampaigns(updated); })
        .catch((error: unknown) => {
          if (active) setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not refresh campaign progress.' });
        });
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [accessToken, campaigns]);

  const directMailHistory = campaigns.filter((campaign) => campaign.mailType === 'DIRECT_MAIL');
  const campaignHistory = campaigns.filter((campaign) => campaign.mailType !== 'DIRECT_MAIL');

  const run = async (action: string, task: () => Promise<void>) => {
    setBusy(action);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'The request could not be completed.' });
    } finally {
      setBusy('');
    }
  };

  const handleSaveSettings = () => run('settings', async () => {
    if (!settingsDraft.appPassword.trim()) throw new Error('Enter the Gmail app password to verify and save the sender.');
    const saved = await saveMarketingSettings(accessToken, settingsDraft);
    setSettings(saved);
    setSettingsDraft((current) => ({ ...current, appPassword: '' }));
    setNotice({ kind: 'success', text: 'Gmail sender verified and saved. The app password is encrypted on the server and will not be shown again.' });
  });

  const handleAddLead = () => run('lead', async () => {
    await addMarketingLead(accessToken, { ...leadDraft, consent: consentConfirmed });
    setLeadDraft({ email: '', name: '', consentSource: '' });
    setConsentConfirmed(false);
    setNotice({ kind: 'success', text: 'Consented lead added.' });
    await refresh();
  });

  const handleImport = (file?: File) => {
    if (!file) return;
    void run('import', async () => {
      const result = await importMarketingLeads(accessToken, file);
      setImportResult(result);
      setNotice({
        kind: result.invalidRows ? 'error' : 'success',
        text: `Imported ${result.imported}; skipped ${result.duplicatesSkipped} duplicates and ${result.invalidRows} invalid rows.`,
      });
      await refresh();
    });
  };

  const handleTest = () => run('test', async () => {
    const result = await sendMarketingTest(accessToken, { to: testTo, subject, body, attachments });
    setNotice({ kind: 'success', text: `Test email sent to ${result.sentTo}.` });
  });

  const handlePreviewDirectRecipients = (file?: File) => run('direct-preview', async () => {
    const preview = await previewMarketingDirectMailRecipients(accessToken, {
      ...(file ? { file } : { emails: directEmailsDraft }),
      consentConfirmed: directConsentConfirmed,
      consentSource: directConsentSource,
    });
    setDirectRecipients(preview);
    if (preview.recipientCount) {
      setNotice({
        kind: preview.rejected.length ? 'error' : 'success',
        text: `${preview.recipientCount} recipient(s) ready to email; new addresses will be added to Leads with the consent source you provided. ${preview.rejected.length} address(es) excluded.`,
      });
    } else {
      setNotice({ kind: 'error', text: 'No recipients are ready. Confirm opt-in, provide the consent source, and preview the list again. Previously unsubscribed addresses remain blocked.' });
    }
  });

  const handleSendDirectMail = () => {
    if (!directRecipients?.recipientCount) {
      setNotice({ kind: 'error', text: 'Add recipients and preview the list before sending.' });
      return;
    }
    if (directRecipients.recipientCount > 5000) {
      setNotice({ kind: 'error', text: 'A direct email can include up to 5,000 recipients.' });
      return;
    }
    const batches = Math.ceil(directRecipients.recipientCount / 50);
    if (!window.confirm(`Send “${directSubject.trim()}” individually to ${directRecipients.recipientCount} opted-in recipients in ${batches} batch${batches === 1 ? '' : 'es'}? New addresses will be saved to Leads with the consent source you provided. Up to 50 emails are sent per minute.`)) return;
    void run('direct-send', async () => {
      const result = await sendMarketingDirectMail(accessToken, {
        recipientEmails: directRecipients.recipients.map((recipient) => recipient.email),
        confirmRecipientCount: directRecipients.recipientCount,
        consentConfirmed: directConsentConfirmed,
        consentSource: directConsentSource,
        subject: directSubject,
        body: directBody,
        attachments: directAttachments,
      });
      setCampaigns((current) => [result, ...current].slice(0, 100));
      setDirectEmailsDraft('');
      setDirectRecipients(null);
      setDirectConsentConfirmed(false);
      setDirectSubject('');
      setDirectBody('');
      setDirectAttachments([]);
      setNotice({
        kind: 'success',
        text: `Individual emails queued for ${result.recipientCount} recipients. Any new addresses were added to Leads with their consent source. Delivery continues in batches of 50 per minute.`,
      });
      setActiveTab('direct');
      void listMarketingLeads(accessToken)
        .then((leadResult) => {
          setLeads(leadResult.leads);
          setSubscribedCount(leadResult.subscribedCount);
          setTotalLeadCount(leadResult.total);
        })
        .catch((error: unknown) => {
          setNotice({
            kind: 'error',
            text: `Emails were queued, but the Leads list could not be refreshed: ${error instanceof Error ? error.message : 'Unknown error.'}`,
          });
        });
    });
  };

  const handleSend = () => {
    if (!subscribedCount) {
      setNotice({ kind: 'error', text: 'Add consented leads before launching a campaign.' });
      return;
    }
    if (subscribedCount > 5000) {
      setNotice({ kind: 'error', text: 'A campaign can include up to 5,000 subscribed leads.' });
      return;
    }
    const batchCount = Math.ceil(subscribedCount / 50);
    const confirmed = window.confirm(`Send “${subject.trim()}” to all ${subscribedCount} subscribed leads in ${batchCount} batch${batchCount === 1 ? '' : 'es'}? Up to 50 emails are sent per minute, with a one-minute pause between batches.`);
    if (!confirmed) return;
    void run('campaign', async () => {
      const result = await sendMarketingCampaign(accessToken, {
        subject, body, confirmRecipientCount: subscribedCount, attachments,
      });
      setCampaigns((current) => [result, ...current].slice(0, 100));
      setSubject('');
      setBody('');
      setAttachments([]);
      setNotice({
        kind: 'success',
        text: `Campaign queued for ${result.recipientCount} leads. Up to 50 emails will be sent per minute; campaign history will update as batches complete.`,
      });
    });
  };

  const toggleRecipients = async (campaignId: string) => {
    if (recipientCampaignId === campaignId) {
      setRecipientCampaignId('');
      setRecipientRows([]);
      return;
    }
    setLoadingRecipients(true);
    setNotice(null);
    try {
      const rows = await listMarketingCampaignRecipients(accessToken, campaignId);
      setRecipientCampaignId(campaignId);
      setRecipientRows(rows);
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Could not load campaign delivery results.' });
    } finally {
      setLoadingRecipients(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['email,name,consent,consentSource\nlead@example.com,Sample Lead,yes,Requested updates on website form\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'hireverify-marketing-leads-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="mx-auto max-w-7xl p-8 text-sm text-[var(--muted)]">Loading Marketing workspace…</div>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[var(--primary)] opacity-[0.07] blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">
              <Megaphone size={14} /> Company growth
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Marketing campaigns</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Build an opted-in CSV lead list, prepare an email, test it, then send automatically in batches of 50 with a one-minute pause.</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-medium hover:bg-[var(--surface-muted)]">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          <Metric icon={Users} label="Subscribed leads" value={subscribedCount} detail="Explicitly consented" />
          <Metric icon={Mail} label="Sender" value={settings.configured ? 'Connected' : 'Not connected'} detail={settings.email || 'Gmail app password required'} />
          <Metric icon={Send} label="Recent campaigns" value={campaignHistory.length} detail="Latest 100 campaigns" />
        </div>
      </header>

      {notice && (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {notice.kind === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-auto" aria-label="Dismiss message"><X size={16} /></button>
        </div>
      )}
      {importResult?.errors.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Some CSV rows need attention</p>
          <ul className="mt-2 list-inside list-disc space-y-1">{importResult.errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      <nav aria-label="Marketing sections" className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          { id: 'campaign', label: 'Campaign', icon: Megaphone },
          { id: 'direct', label: 'Individual email', icon: Mail },
          { id: 'leads', label: 'Leads', icon: Users },
          { id: 'sender', label: 'Sender settings', icon: Settings2 },
          { id: 'history', label: 'Campaign history', icon: Send },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${activeTab === id ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'}`}
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </nav>

      <section role="tabpanel" className="space-y-6">
        {activeTab === 'sender' && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Settings2} title="Sender setup" subtitle="Gmail SMTP app passwords are verified before saving." />
            <div className="mt-5 grid gap-4">
              <Field label="Gmail or Google Workspace email">
                <input className={inputClass} type="email" autoComplete="email" value={settingsDraft.email} onChange={(event) => setSettingsDraft({ ...settingsDraft, email: event.target.value })} placeholder="you@company.com" />
              </Field>
              <Field label="From name">
                <input className={inputClass} value={settingsDraft.fromName} onChange={(event) => setSettingsDraft({ ...settingsDraft, fromName: event.target.value })} placeholder="Your company" />
              </Field>
              <Field label="Google app password">
                <input className={inputClass} type="password" autoComplete="new-password" value={settingsDraft.appPassword} onChange={(event) => setSettingsDraft({ ...settingsDraft, appPassword: event.target.value })} placeholder={settings.configured ? 'Enter a new app password to update' : '16-character app password'} />
              </Field>
              <p className="text-xs leading-5 text-[var(--muted)]">Create an app password in your Google Account after enabling 2-Step Verification. Credentials are encrypted in the backend and never returned to this page.</p>
              {canManage && <button type="button" onClick={handleSaveSettings} disabled={Boolean(busy)} className={buttonClass}>{busy === 'settings' ? 'Verifying…' : 'Verify and save sender'}</button>}
            </div>
          </section>
        )}

        {activeTab === 'leads' && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Users} title="Lead audience" subtitle="Only contact people who explicitly agreed to receive marketing." />
            {canManage && (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Email">
                    <input className={inputClass} type="email" value={leadDraft.email} onChange={(event) => setLeadDraft({ ...leadDraft, email: event.target.value })} placeholder="lead@example.com" />
                  </Field>
                  <Field label="Name (optional)">
                    <input className={inputClass} value={leadDraft.name} onChange={(event) => setLeadDraft({ ...leadDraft, name: event.target.value })} placeholder="Lead name" />
                  </Field>
                  <Field label="How did they consent?">
                    <input className={inputClass} value={leadDraft.consentSource} onChange={(event) => setLeadDraft({ ...leadDraft, consentSource: event.target.value })} placeholder="Website signup form, 12 May" />
                  </Field>
                  <div className="flex items-end">
                    <button type="button" onClick={handleAddLead} disabled={Boolean(busy) || !leadDraft.email || !leadDraft.consentSource || !consentConfirmed} className={`${buttonClass} w-full`}>
                      <Plus size={16} /> Add consented lead
                    </button>
                  </div>
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                  <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-1 accent-[var(--primary)]" />
                  I confirm this person explicitly agreed to receive marketing emails, and the consent source above is accurate.
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Import a CSV</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Required columns: email, consent, consentSource. Use yes/true/1 for consent; name is optional. Maximum 5,000 rows.</p>
                  </div>
                  <button type="button" onClick={downloadTemplate} className="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]">Download template</button>
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)] ${busy === 'import' ? 'pointer-events-none opacity-50' : ''}`}>
                    <FileUp size={16} /> {busy === 'import' ? 'Importing…' : 'Choose CSV'}
                    <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { handleImport(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                  </label>
                </div>
              </>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Lead email list</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Showing {leads.length} of {totalLeadCount} leads · {subscribedCount} subscribed and eligible for campaigns
                </p>
              </div>
              {canSend && subscribedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab(settings.configured ? 'campaign' : 'sender')}
                  className={buttonClass}
                >
                  {settings.configured ? <Mail size={16} /> : <Settings2 size={16} />}
                  {settings.configured ? `Compose email to ${subscribedCount} leads` : 'Connect sender to email these leads'}
                </button>
              )}
            </div>
            {totalLeadCount > leads.length && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                The list preview is capped at {leads.length} rows. There are {totalLeadCount} leads total; the campaign audience is limited to 5,000 subscribed leads.
              </p>
            )}
            <div className="mt-3 max-h-[32rem] overflow-auto rounded-2xl border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="sticky top-0 bg-[var(--surface-muted)] text-[var(--muted)]">
                  <tr><th className="px-3 py-2.5 font-semibold">Lead email</th><th className="px-3 py-2.5 font-semibold">Consent source</th><th className="px-3 py-2.5 font-semibold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-3 py-2.5">
                        {lead.name && <span className="mb-0.5 block font-medium">{lead.name}</span>}
                        <a href={`mailto:${lead.email}`} className="font-medium text-[var(--primary)] underline-offset-2 hover:underline">{lead.email}</a>
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-[var(--muted)]">{lead.consentSource}</td>
                      <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 font-semibold ${lead.unsubscribedAt ? 'bg-[var(--surface-muted)] text-[var(--muted)]' : 'bg-emerald-50 text-emerald-700'}`}>{lead.unsubscribedAt ? 'Unsubscribed' : 'Subscribed'}</span></td>
                    </tr>
                  ))}
                  {!leads.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-[var(--muted)]">No leads yet. Add one or import a consented list.</td></tr>}
                </tbody>
              </table>
            </div>
            {!canSend && subscribedCount > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                You can view and open individual lead emails. Ask a company administrator for the marketing.send permission to launch campaigns.
              </p>
            )}
          </section>
        )}

        {activeTab === 'direct' && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Mail} title="Send individual emails" subtitle="Enter addresses or upload a CSV with an email column. Every message is delivered separately with shared subject, content, and attachments." />
            <div className="mt-5 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <Field label="Recipient email addresses">
                  <textarea
                    className={`${inputClass} min-h-32 resize-y`}
                    value={directEmailsDraft}
                    onChange={(event) => {
                      setDirectEmailsDraft(event.target.value);
                      setDirectRecipients(null);
                    }}
                    placeholder="person1@example.com, person2@example.com"
                    disabled={busy === 'direct-preview'}
                  />
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Separate email addresses with commas, semicolons, or new lines. CSV files must contain an email column.</span>
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePreviewDirectRecipients()}
                    disabled={Boolean(busy) || !directEmailsDraft.trim() || !directConsentConfirmed || !directConsentSource.trim()}
                    className={buttonClass}
                  >
                    <Users size={16} /> {busy === 'direct-preview' ? 'Checking…' : 'Check recipients'}
                  </button>
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)] ${busy === 'direct-preview' || !directConsentConfirmed || !directConsentSource.trim() ? 'pointer-events-none opacity-50' : ''}`}>
                    <FileUp size={16} /> Upload recipient CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      disabled={Boolean(busy) || !directConsentConfirmed || !directConsentSource.trim()}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setDirectEmailsDraft('');
                          handlePreviewDirectRecipients(file);
                        }
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <p>Every recipient must have explicitly opted in to receive these emails. New addresses will be added to your Leads list with the consent source below. Previously unsubscribed addresses are always blocked.</p>
                  <Field label="Consent source (required)">
                    <input
                      className={inputClass}
                      maxLength={255}
                      value={directConsentSource}
                      onChange={(event) => {
                        setDirectConsentSource(event.target.value);
                        setDirectRecipients(null);
                      }}
                      placeholder="Website signup form, event registration, etc."
                    />
                  </Field>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={directConsentConfirmed}
                      onChange={(event) => {
                        setDirectConsentConfirmed(event.target.checked);
                        setDirectRecipients(null);
                      }}
                      className="mt-1 accent-[var(--primary)]"
                    />
                    <span>I confirm all addresses in this list have explicitly consented to receive these emails, and the consent source above is accurate.</span>
                  </label>
                </div>
                <Field label="Email subject">
                  <input className={inputClass} maxLength={255} value={directSubject} onChange={(event) => setDirectSubject(event.target.value)} placeholder="Email subject" />
                </Field>
                <Field label="Email content">
                  <textarea className={`${inputClass} min-h-40 resize-y`} maxLength={10000} value={directBody} onChange={(event) => setDirectBody(event.target.value)} placeholder="Write the message to send individually to each selected recipient." />
                </Field>
                <Field label="Attachments (optional)">
                  <input className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-xs file:font-semibold`} type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg" multiple onChange={(event) => setDirectAttachments(Array.from(event.target.files || []))} />
                  <span className="mt-1 block text-xs text-[var(--muted)]">Up to 3 PDF, TXT, CSV, PNG, or JPG files; 5 MB each.</span>
                </Field>
                {canSend && (
                  <button
                    type="button"
                    onClick={handleSendDirectMail}
                    disabled={Boolean(busy) || !settings.configured || !directRecipients?.recipientCount || !directSubject.trim() || !directBody.trim() || !directConsentConfirmed || !directConsentSource.trim() || directRecipients.recipientCount > 5000}
                    className={buttonClass}
                  >
                    <Send size={16} /> {busy === 'direct-send' ? 'Queueing emails…' : `Send to ${directRecipients?.recipientCount || 0} recipients`}
                  </button>
                )}
                {!settings.configured && <p className="text-xs text-amber-800">Connect a verified sender in Sender settings before sending.</p>}
              </div>
              <div className="rounded-2xl border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">Recipient list</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {directRecipients ? `${directRecipients.recipientCount} eligible · ${directRecipients.rejected.length} excluded` : 'Check or upload addresses to preview who can be emailed.'}
                    </p>
                  </div>
                  {directRecipients?.recipientCount ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{directRecipients.recipientCount} ready</span> : null}
                </div>
                <div className="max-h-[34rem] divide-y divide-[var(--border)] overflow-y-auto">
                  {directRecipients?.recipients.map((recipient) => (
                    <div key={recipient.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        {recipient.name && <span className="block truncate text-xs font-medium text-[var(--muted)]">{recipient.name}</span>}
                        <a href={`mailto:${recipient.email}`} className="break-all font-medium text-[var(--primary)] hover:underline">{recipient.email}</a>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${recipient.isNew ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {recipient.isNew ? 'Will add as opted in' : 'Opted in'}
                      </span>
                    </div>
                  ))}
                  {directRecipients?.rejected.map((recipient, index) => (
                    <div key={`${recipient.email}-${index}`} className="px-4 py-3">
                      <p className="break-all text-sm font-medium text-[var(--muted)]">{recipient.email || '(blank address)'}</p>
                      <p className="mt-1 text-xs text-amber-800">{recipient.reason}</p>
                    </div>
                  ))}
                  {!directRecipients && <p className="p-8 text-center text-sm text-[var(--muted)]">Recipient addresses will appear here after you check or upload them.</p>}
                  {directRecipients?.recipientCount === 0 && !directRecipients.rejected.length && <p className="p-8 text-center text-sm text-[var(--muted)]">No subscribed recipients in the provided list.</p>}
                </div>
              </div>
            </div>
            <div className="mt-8 border-t border-[var(--border)] pt-6">
              <SectionTitle icon={Send} title="Individual email history" subtitle="Queue status and per-recipient delivery results for your individual messages." />
              {directMailHistory.length ? (
                <div className="mt-4 space-y-3">
                  {directMailHistory.map((campaign) => (
                    <article key={campaign.id} className="rounded-2xl border border-[var(--border)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">{campaign.subject}</h3>
                          <p className="mt-1 text-xs text-[var(--muted)]">{new Date(campaign.createdAt).toLocaleString()}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${campaign.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : campaign.status === 'PARTIAL' ? 'bg-amber-50 text-amber-800' : campaign.status === 'SENDING' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{campaign.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                        <span>{campaign.sentCount}/{campaign.recipientCount} sent</span>
                        <span>{campaign.failedCount} failed</span>
                        {campaign.skippedCount > 0 && <span>{campaign.skippedCount} skipped (unsubscribed)</span>}
                        {campaign.attachmentNames.length > 0 && <span>{campaign.attachmentNames.length} attachment(s)</span>}
                      </div>
                      {campaign.status === 'SENDING' && (
                        <p className="mt-2 text-xs font-medium text-blue-700">
                          {campaign.nextBatchAt && Date.parse(campaign.nextBatchAt) > currentTime
                            ? `Next batch in ${Math.floor((Date.parse(campaign.nextBatchAt) - currentTime) / 60000)}:${String(Math.floor(((Date.parse(campaign.nextBatchAt) - currentTime) % 60000) / 1000)).padStart(2, '0')}`
                            : 'Sending current batch…'}
                        </p>
                      )}
                      <button type="button" onClick={() => void toggleRecipients(campaign.id)} disabled={loadingRecipients} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] disabled:opacity-50">
                        <Eye size={14} /> {recipientCampaignId === campaign.id ? 'Hide delivery details' : 'View delivery details'}
                      </button>
                      {recipientCampaignId === campaign.id && (
                        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-[var(--border)] pt-3">
                          {recipientRows.map((recipient) => (
                            <div key={recipient.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                              <span className="break-all">{recipient.email}</span>
                              <span className={`font-semibold ${recipient.status === 'SENT' ? 'text-emerald-700' : recipient.status === 'SKIPPED' ? 'text-[var(--muted)]' : 'text-red-700'}`}>{recipient.status}</span>
                              {recipient.error && <span className="w-full text-[var(--muted)]">{recipient.error}</span>}
                            </div>
                          ))}
                          {!recipientRows.length && <p className="text-xs text-[var(--muted)]">No delivery rows found.</p>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">No individual emails sent yet.</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'campaign' && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Megaphone} title="Compose campaign" subtitle="Test first, then confirm the recipient count before launch." />
            <div className="mt-5 space-y-4">
              <Field label="Email subject">
                <input className={inputClass} maxLength={255} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A helpful update from your company" />
              </Field>
              <Field label="Message">
                <textarea className={`${inputClass} min-h-48 resize-y`} maxLength={10000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a clear, relevant message. Keep it useful and identify your company." />
                <span className="mt-1 block text-right text-[11px] text-[var(--muted)]">{body.length}/10,000</span>
              </Field>
              <Field label="Attachments (optional)">
                <input className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-1.5 file:text-xs file:font-semibold`} type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg" multiple onChange={(event) => setAttachments(Array.from(event.target.files || []))} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Up to 3 PDF, TXT, CSV, PNG, or JPG files; 5 MB each.</span>
              </Field>
              {attachments.length > 0 && <p className="text-xs text-[var(--muted)]">Selected: {attachments.map((file) => file.name).join(', ')}</p>}
              {canSend && (
                <>
                  {(!settings.configured || !subject.trim() || !body.trim() || !subscribedCount || subscribedCount > 5000) && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted)]">
                      <p className="font-semibold text-[var(--foreground)]">Before sending</p>
                      <ul className="mt-1 list-inside list-disc">
                        {!settings.configured && <li><button type="button" onClick={() => setActiveTab('sender')} className="font-semibold text-[var(--primary)] underline">Connect and verify a sender</button></li>}
                        {!subscribedCount && <li>Import a CSV with consented leads in the Leads tab.</li>}
                        {subscribedCount > 5000 && <li>Campaigns support up to 5,000 subscribed leads at a time.</li>}
                        {!subject.trim() && <li>Enter an email subject.</li>}
                        {!body.trim() && <li>Write the email message.</li>}
                      </ul>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input className={inputClass} type="email" value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="Your email for a test" aria-label="Test email recipient" />
                    <button type="button" onClick={handleTest} disabled={Boolean(busy) || !settings.configured || !testTo || !subject || !body} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50">
                      <Mail size={16} /> {busy === 'test' ? 'Sending…' : 'Send test'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-muted)] p-4">
                    <div>
                      <p className="text-sm font-semibold">{subscribedCount} subscribed recipients</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Up to 50 emails per minute; batches pause for one minute. Maximum 5,000 leads per campaign. The company mailing address and unsubscribe link are added automatically.</p>
                    </div>
                    <button type="button" onClick={handleSend} disabled={Boolean(busy) || !settings.configured || !subscribedCount || !subject.trim() || !body.trim() || subscribedCount > 5000} className={buttonClass}>
                      <Send size={16} /> {busy === 'campaign' ? 'Sending campaign…' : 'Review & launch'}
                    </button>
                  </div>
                </>
              )}
              {!canSend && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">You have view-only access to Marketing. Ask a company administrator for the marketing.send permission to test or launch campaigns.</p>}
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
            <SectionTitle icon={Send} title="Campaign history" subtitle="Delivery totals for the latest 100 campaigns." />
            <div className="mt-5 space-y-3">
              {campaignHistory.map((campaign) => (
                <article key={campaign.id} className="rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{campaign.subject}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{new Date(campaign.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${campaign.status === 'SENT' ? 'bg-emerald-50 text-emerald-700' : campaign.status === 'PARTIAL' ? 'bg-amber-50 text-amber-800' : campaign.status === 'SENDING' ? 'bg-blue-50 text-blue-700' : campaign.status === 'SKIPPED' ? 'bg-[var(--surface-muted)] text-[var(--muted)]' : 'bg-red-50 text-red-700'}`}>{campaign.status === 'SENDING' ? 'SENDING' : campaign.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                    <span>{campaign.sentCount}/{campaign.recipientCount} sent</span>
                    <span>{campaign.failedCount} failed</span>
                    {campaign.skippedCount > 0 && <span>{campaign.skippedCount} skipped (unsubscribed)</span>}
                    {campaign.attachmentNames.length > 0 && <span>{campaign.attachmentNames.length} attachment(s)</span>}
                  </div>
                  {campaign.status === 'SENDING' && (
                    <p className="mt-2 text-xs font-medium text-blue-700">
                      {campaign.nextBatchAt && Date.parse(campaign.nextBatchAt) > currentTime
                        ? `Next batch in ${Math.floor((Date.parse(campaign.nextBatchAt) - currentTime) / 60000)}:${String(Math.floor(((Date.parse(campaign.nextBatchAt) - currentTime) % 60000) / 1000)).padStart(2, '0')}`
                        : 'Sending current batch…'}
                    </p>
                  )}
                  <button type="button" onClick={() => void toggleRecipients(campaign.id)} disabled={loadingRecipients} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] disabled:opacity-50">
                    <Eye size={14} /> {recipientCampaignId === campaign.id ? 'Hide delivery details' : 'View delivery details'}
                  </button>
                  {recipientCampaignId === campaign.id && (
                    <div className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-[var(--border)] pt-3">
                      {recipientRows.map((recipient) => (
                        <div key={recipient.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                          <span className="break-all">{recipient.email}</span>
                          <span className={`font-semibold ${recipient.status === 'SENT' ? 'text-emerald-700' : recipient.status === 'SKIPPED' ? 'text-[var(--muted)]' : 'text-red-700'}`}>{recipient.status}</span>
                          {recipient.error && <span className="w-full text-[var(--muted)]">{recipient.error}</span>}
                        </div>
                      ))}
                      {!recipientRows.length && <p className="text-xs text-[var(--muted)]">No delivery rows found.</p>}
                    </div>
                  )}
                </article>
              ))}
              {!campaignHistory.length && <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">No campaigns yet. Your sent campaigns will appear here.</div>}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Icon size={15} className="text-[var(--primary)]" />{label}</div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-[11px] text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Users; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-[var(--surface-muted)] p-2.5 text-[var(--primary)]"><Icon size={18} /></div>
      <div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{subtitle}</p></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className={labelClass}>{label}</span>{children}</label>;
}
