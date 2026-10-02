'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { prisma } = require('../../common/prisma');
const { BadRequestError, ConflictError, ForbiddenError, NotFoundError } = require('../../utils/errors');

const MAX_CAMPAIGN_RECIPIENTS = 5000;
const CAMPAIGN_BATCH_SIZE = 50;
const CAMPAIGN_BATCH_INTERVAL_MS = 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logger = require('../../common/logger');
const activeCompanyWorkers = new Map();

const companyIdFor = (user) => {
  if (!user.companyId) throw new ForbiddenError('Marketing is available only to company users.');
  return user.companyId;
};

const encryptionKey = () => {
  const value = process.env.MARKETING_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('MARKETING_ENCRYPTION_KEY must be configured as 64 hexadecimal characters.');
  }
  return Buffer.from(value, 'hex');
};

const encryptPassword = (password) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
};

const decryptPassword = (value) => {
  const [ivHex, tagHex, ciphertextHex] = value.split(':');
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error('Stored marketing SMTP credentials are invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
};

const unsubscribeKey = () => crypto.createHmac('sha256', encryptionKey()).update('marketing-unsubscribe-v1').digest();
const signUnsubscribe = (leadId, companyId) => {
  const payload = `${leadId}.${companyId}`;
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', unsubscribeKey()).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
};

const verifyUnsubscribe = (token) => {
  const [encoded, suppliedSignature] = String(token || '').split('.');
  if (!encoded || !suppliedSignature || !/^[a-f\d]{64}$/i.test(suppliedSignature)) return null;
  const expected = crypto.createHmac('sha256', unsubscribeKey()).update(encoded).digest();
  const supplied = Buffer.from(suppliedSignature, 'hex');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  const [leadId, companyId] = Buffer.from(encoded, 'base64url').toString('utf8').split('.');
  return leadId && companyId ? { leadId, companyId } : null;
};

const smtpTransport = (email, password) => nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: email, pass: password },
  tls: { minVersion: 'TLSv1.2' },
});

const readSmtpConfig = async (companyId) => {
  const config = await prisma.marketingSmtpConfig.findUnique({ where: { companyId } });
  if (!config) throw new NotFoundError('Connect a Gmail sender account before sending marketing email.');
  return { ...config, password: decryptPassword(config.passwordEncrypted) };
};

const getSettings = async (user) => {
  const config = await prisma.marketingSmtpConfig.findUnique({
    where: { companyId: companyIdFor(user) },
    select: { email: true, fromName: true, updatedAt: true },
  });
  return { configured: Boolean(config), ...(config || {}) };
};

const saveSettings = async (user, { email, fromName, appPassword }) => {
  const companyId = companyIdFor(user);
  encryptionKey();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedName = String(fromName || '').trim();
  const password = String(appPassword || '').replace(/\s/g, '');
  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 255) throw new BadRequestError('Enter a valid Gmail address.');
  if (!normalizedName || normalizedName.length > 150 || /[\r\n]/.test(normalizedName)) throw new BadRequestError('Sender name is required (maximum 150 characters).');
  if (!/^[a-z\d]{16}$/i.test(password)) throw new BadRequestError('Enter the 16-character Google app password.');

  const transport = smtpTransport(normalizedEmail, password);
  try {
    await transport.verify();
  } catch (error) {
    if (error?.code === 'EAUTH') {
      throw new BadRequestError('Gmail rejected these credentials. Check the email, app password, and Google account 2-Step Verification.');
    }
    const detail = String(error?.message || 'Unknown SMTP verification error.').replace(/[\r\n]+/g, ' ').slice(0, 250);
    throw new BadRequestError(`Could not verify the Gmail SMTP connection: ${detail}`);
  } finally {
    transport.close();
  }

  const passwordEncrypted = encryptPassword(password);
  const config = await prisma.marketingSmtpConfig.upsert({
    where: { companyId },
    create: { companyId, email: normalizedEmail, fromName: normalizedName, passwordEncrypted, updatedById: user.id },
    update: { email: normalizedEmail, fromName: normalizedName, passwordEncrypted, updatedById: user.id },
    select: { email: true, fromName: true, updatedAt: true },
  });
  return { configured: true, ...config };
};

const normalizeLead = (lead, rowNumber) => {
  const email = String(lead.email || '').trim().toLowerCase();
  const name = String(lead.name || '').trim();
  const consentSource = String(lead.consentSource || '').trim();
  const hasConsent = lead.consent === true || ['yes', 'true', '1', 'opted-in', 'opted in'].includes(String(lead.consent || '').trim().toLowerCase());
  if (!EMAIL_PATTERN.test(email) || email.length > 255) return { error: `Row ${rowNumber}: invalid email address.` };
  if (!hasConsent || !consentSource) return { error: `Row ${rowNumber}: explicit consent and consentSource are required.` };
  if (name.length > 150 || consentSource.length > 255) return { error: `Row ${rowNumber}: name or consentSource is too long.` };
  return { email, name: name || null, consentSource };
};

const addLead = async (user, payload) => {
  const companyId = companyIdFor(user);
  const lead = normalizeLead(payload, 1);
  if (lead.error) throw new BadRequestError(lead.error);
  const existing = await prisma.marketingLead.findUnique({
    where: { companyId_email: { companyId, email: lead.email } },
    select: { id: true },
  });
  if (existing) throw new ConflictError('This email is already in the company lead list. An unsubscribed lead cannot be re-added.');
  return prisma.marketingLead.create({
    data: { companyId, ...lead, createdById: user.id },
    select: { id: true, email: true, name: true, consentSource: true, consentedAt: true, unsubscribedAt: true, createdAt: true },
  });
};

const importLeads = async (user, rows) => {
  const companyId = companyIdFor(user);
  if (!Array.isArray(rows) || rows.length < 2) throw new BadRequestError('The CSV must contain a header and at least one lead.');
  if (rows.length > 5001) throw new BadRequestError('Import a maximum of 5,000 leads at a time.');
  const header = rows[0].map((value) => String(value || '').trim().toLowerCase());
  const emailIndex = header.indexOf('email');
  const consentIndex = header.indexOf('consent');
  const sourceIndex = header.indexOf('consentsource');
  const nameIndex = header.indexOf('name');
  if (emailIndex < 0 || consentIndex < 0 || sourceIndex < 0) {
    throw new BadRequestError('CSV headers must include email, consent, and consentSource. Optional: name.');
  }

  const leads = [];
  const errors = [];
  rows.slice(1).forEach((row, index) => {
    if (!row.some((value) => String(value || '').trim())) return;
    const lead = normalizeLead({
      email: row[emailIndex],
      consent: row[consentIndex],
      consentSource: row[sourceIndex],
      name: nameIndex < 0 ? '' : row[nameIndex],
    }, index + 2);
    if (lead.error) errors.push(lead.error);
    else leads.push({ companyId, ...lead, createdById: user.id });
  });
  if (errors.length && leads.length === 0) throw new BadRequestError('No valid leads were found in the CSV.', errors.slice(0, 20));
  if (leads.length === 0) throw new BadRequestError('The CSV has no lead rows to import.');

  const result = await prisma.marketingLead.createMany({ data: leads, skipDuplicates: true });
  return {
    imported: result.count,
    duplicatesSkipped: leads.length - result.count,
    invalidRows: errors.length,
    errors: errors.slice(0, 20),
  };
};

const previewDirectMailRecipients = async (user, rawEmails, { consentConfirmed, consentSource } = {}) => {
  const companyId = companyIdFor(user);
  if (!Array.isArray(rawEmails) || rawEmails.length === 0) {
    throw new BadRequestError('Provide at least one email address.');
  }
  const submittedEmails = rawEmails.flatMap((value) => String(value || '').split(/[,\n;\r]+/));
  if (submittedEmails.length > MAX_CAMPAIGN_RECIPIENTS) {
    throw new BadRequestError(`A direct email can include at most ${MAX_CAMPAIGN_RECIPIENTS} addresses.`);
  }
  const hasConsent = consentConfirmed === true || ['true', '1', 'yes'].includes(String(consentConfirmed || '').trim().toLowerCase());
  const source = String(consentSource || '').trim();
  if (source.length > 255) throw new BadRequestError('Consent source must be at most 255 characters.');
  const requestedEmails = [];
  const invalidEmails = [];
  const seenEmails = new Set();
  for (const value of submittedEmails) {
    const email = String(value || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email) || email.length > 255) {
      invalidEmails.push({ email, reason: 'Invalid email address.' });
      continue;
    }
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    requestedEmails.push(email);
  }
  if (!requestedEmails.length) {
    return { recipients: [], rejected: invalidEmails, recipientCount: 0 };
  }

  const leads = await prisma.marketingLead.findMany({
    where: { companyId, email: { in: requestedEmails } },
    select: { id: true, email: true, name: true, unsubscribedAt: true, consentSource: true },
  });
  const leadByEmail = new Map(leads.map((lead) => [lead.email.toLowerCase(), lead]));
  const recipients = [];
  const rejected = [...invalidEmails];
  requestedEmails.forEach((email) => {
    const lead = leadByEmail.get(email);
    if (lead?.unsubscribedAt) {
      rejected.push({ email, reason: 'This lead has unsubscribed and cannot receive email.' });
    } else if (!lead && (!hasConsent || !source)) {
      rejected.push({ email, reason: 'Confirm the recipient opted in and provide the consent source to add this address.' });
    } else {
      recipients.push({
        id: lead?.id || null,
        email: lead?.email || email,
        name: lead?.name || null,
        isNew: !lead,
      });
    }
  });
  return { recipients, rejected, recipientCount: recipients.length };
};

const sendDirectMail = async (user, {
  recipientEmails, consentConfirmed, consentSource, subject, body, confirmRecipientCount,
}, attachments = []) => {
  const companyId = companyIdFor(user);
  const emails = [...new Set(Array.isArray(recipientEmails)
    ? recipientEmails.map((email) => String(email || '').trim().toLowerCase())
    : [])];
  if (!emails.length) throw new BadRequestError('Preview and select at least one recipient before sending.');
  if (emails.length > MAX_CAMPAIGN_RECIPIENTS) throw new BadRequestError(`A direct email can include at most ${MAX_CAMPAIGN_RECIPIENTS} addresses.`);
  if (emails.some((email) => !EMAIL_PATTERN.test(email) || email.length > 255)) {
    throw new BadRequestError('The recipient list contains an invalid email address. Preview the list again.');
  }
  if (Number(confirmRecipientCount) !== emails.length) throw new BadRequestError('The recipient count changed. Preview and confirm the recipients again.');
  const hasConsent = consentConfirmed === true || ['true', '1', 'yes'].includes(String(consentConfirmed || '').trim().toLowerCase());
  const source = String(consentSource || '').trim();
  if (!hasConsent) throw new BadRequestError('Confirm that every recipient has opted in before sending individual emails.');
  if (!source || source.length > 255) throw new BadRequestError('Enter the consent source (maximum 255 characters).');
  const cleanSubject = String(subject || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanSubject || cleanSubject.length > 255 || /[\r\n]/.test(cleanSubject)) {
    throw new BadRequestError('Subject is required, must not contain newlines, and must be at most 255 characters.');
  }
  if (!cleanBody || cleanBody.length > 10000) throw new BadRequestError('Message is required (maximum 10,000 characters).');

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, address: true, city: true, state: true, postalCode: true, country: true },
  });
  const mailingAddress = company?.address?.trim()
    || [company?.city, company?.state, company?.postalCode, company?.country].filter(Boolean).join(', ');
  if (!mailingAddress) throw new BadRequestError('Add a physical mailing address in Company Profile before sending.');
  publicBaseUrl();
  await readSmtpConfig(companyId);

  const result = await prisma.$transaction(async (tx) => {
    const existingLeads = await tx.marketingLead.findMany({
      where: { companyId, email: { in: emails } },
      select: { id: true, email: true, name: true, unsubscribedAt: true },
    });
    const unsubscribed = existingLeads.filter((lead) => lead.unsubscribedAt);
    if (unsubscribed.length) {
      throw new BadRequestError('One or more recipients have unsubscribed and cannot receive email. Preview the list again.');
    }

    const knownEmails = new Set(existingLeads.map((lead) => lead.email.toLowerCase()));
    const newEmails = emails.filter((email) => !knownEmails.has(email));
    if (newEmails.length) {
      await tx.marketingLead.createMany({
        data: newEmails.map((email) => ({
          companyId,
          email,
          consentSource: source,
          createdById: user.id,
        })),
        skipDuplicates: true,
      });
    }
    const leads = await tx.marketingLead.findMany({
      where: { companyId, email: { in: emails } },
      select: { id: true, email: true, unsubscribedAt: true },
    });
    if (leads.length !== emails.length || leads.some((lead) => lead.unsubscribedAt)) {
      throw new BadRequestError('The recipient list changed or includes an unsubscribed lead. Preview the list again.');
    }

    return tx.marketingCampaign.create({
      data: {
        companyId,
        mailType: 'DIRECT_MAIL',
        subject: cleanSubject,
        body: `${cleanBody}\n\n${company.name}\n${mailingAddress}`,
        status: 'SENDING',
        attachmentNames: attachments.map((file) => file.originalname.replace(/[\r\n"]/g, '_')),
        recipientCount: leads.length,
        createdById: user.id,
        recipients: {
          create: leads.map((lead) => ({ leadId: lead.id, email: lead.email, status: 'PENDING' })),
        },
        attachments: {
          create: attachments.map((file) => ({
            filename: file.originalname.replace(/[\r\n"]/g, '_'),
            contentType: file.mimetype,
            content: file.buffer,
          })),
        },
      },
      select: {
        id: true, mailType: true, subject: true, status: true, attachmentNames: true,
        recipientCount: true, sentCount: true, failedCount: true, skippedCount: true,
        nextBatchAt: true, createdAt: true, completedAt: true,
      },
    });
  });
  scheduleCompanyQueue(companyId);
  return result;
};

const listLeads = async (user) => {
  const companyId = companyIdFor(user);
  const [leads, total, subscribedCount] = await Promise.all([
    prisma.marketingLead.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: { id: true, email: true, name: true, consentSource: true, consentedAt: true, unsubscribedAt: true, createdAt: true },
    }),
    prisma.marketingLead.count({ where: { companyId } }),
    prisma.marketingLead.count({ where: { companyId, unsubscribedAt: null } }),
  ]);
  return { leads, total, subscribedCount };
};

const listCampaigns = async (user) => prisma.marketingCampaign.findMany({
  where: { companyId: companyIdFor(user) },
  orderBy: { createdAt: 'desc' },
  take: 100,
  select: {
    id: true, mailType: true, subject: true, status: true, attachmentNames: true,
    recipientCount: true, sentCount: true, failedCount: true, skippedCount: true,
    nextBatchAt: true, createdAt: true, completedAt: true,
  },
});

const listCampaignRecipients = async (user, campaignId) => {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, companyId: companyIdFor(user) },
    select: { id: true },
  });
  if (!campaign) throw new NotFoundError('Campaign not found.');
  return prisma.marketingCampaignRecipient.findMany({
    where: { campaignId },
    orderBy: [{ status: 'asc' }, { email: 'asc' }],
    select: { id: true, email: true, status: true, error: true, sentAt: true },
  });
};

const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const publicBaseUrl = () => {
  const value = process.env.MARKETING_PUBLIC_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
  if (!value) throw new BadRequestError('Set MARKETING_PUBLIC_URL to the public frontend origin before launching campaigns.');
  return value.split(',')[0].trim().replace(/\/$/, '');
};

const sendOne = async (transport, config, recipient, content, attachments, unsubscribeUrl) => {
  const text = unsubscribeUrl ? `${content.body}\n\nUnsubscribe: ${unsubscribeUrl}` : content.body;
  const html = unsubscribeUrl
    ? `${escapeHtml(content.body).replace(/\r?\n/g, '<br>')}<br><br><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a>`
    : escapeHtml(content.body).replace(/\r?\n/g, '<br>');
  return transport.sendMail({
    from: { name: config.fromName, address: config.email },
    to: recipient,
    subject: content.subject,
    text,
    html,
    attachments: attachments.map((file) => ({
      filename: file.originalname.replace(/[\r\n"]/g, '_'),
      content: file.buffer,
      contentType: file.mimetype,
    })),
    headers: unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>` } : undefined,
  });
};

const sendTest = async (user, { to, subject, body }, attachments = []) => {
  const companyId = companyIdFor(user);
  const recipient = String(to || '').trim().toLowerCase();
  const cleanSubject = String(subject || '').trim();
  const cleanBody = String(body || '').trim();
  if (!EMAIL_PATTERN.test(recipient) || recipient.length > 255) throw new BadRequestError('Enter a valid test recipient email.');
  if (!cleanSubject || cleanSubject.length > 255 || /[\r\n]/.test(cleanSubject)) throw new BadRequestError('Subject is required, must not contain newlines, and must be at most 255 characters.');
  if (!cleanBody || cleanBody.length > 10000) throw new BadRequestError('Message is required (maximum 10,000 characters).');
  const config = await readSmtpConfig(companyId);
  const transport = smtpTransport(config.email, config.password);
  try {
    await sendOne(transport, config, recipient, { subject: `[TEST] ${cleanSubject}`, body: cleanBody }, attachments, null);
  } catch (error) {
    const detail = String(error?.message || 'Email delivery failed.').replace(/[\r\n]+/g, ' ').slice(0, 250);
    throw new BadRequestError(`Test email could not be sent: ${detail}`);
  } finally {
    transport.close();
  }
  return { sentTo: recipient };
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const setCampaignCountsAndStatus = async (campaignId, statusOverride) => {
  const [sentCount, failedCount, skippedCount, pendingCount] = await Promise.all([
    prisma.marketingCampaignRecipient.count({ where: { campaignId, status: 'SENT' } }),
    prisma.marketingCampaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
    prisma.marketingCampaignRecipient.count({ where: { campaignId, status: 'SKIPPED' } }),
    prisma.marketingCampaignRecipient.count({ where: { campaignId, status: { in: ['PENDING', 'SENDING'] } } }),
  ]);
  const status = statusOverride || (pendingCount
    ? 'SENDING'
    : sentCount && (failedCount || skippedCount)
      ? 'PARTIAL'
      : sentCount
        ? 'SENT'
        : failedCount
          ? 'FAILED'
          : 'SKIPPED');
  return prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      failedCount,
      skippedCount,
      status,
      completedAt: pendingCount ? null : new Date(),
      ...(pendingCount ? {} : { nextBatchAt: null }),
    },
    select: {
      id: true, subject: true, status: true, attachmentNames: true,
      recipientCount: true, sentCount: true, failedCount: true, skippedCount: true,
      nextBatchAt: true, createdAt: true, completedAt: true,
    },
  });
};

const waitForCompanyCapacity = async (companyId, campaignId) => {
  while (true) {
    const since = new Date(Date.now() - CAMPAIGN_BATCH_INTERVAL_MS);
    const [recentCount, oldestAttempt] = await Promise.all([
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { companyId }, attemptedAt: { gte: since } },
      }),
      prisma.marketingCampaignRecipient.findFirst({
        where: { campaign: { companyId }, attemptedAt: { gte: since } },
        orderBy: { attemptedAt: 'asc' },
        select: { attemptedAt: true },
      }),
    ]);
    if (recentCount < CAMPAIGN_BATCH_SIZE || !oldestAttempt?.attemptedAt) return;

    const nextBatchAt = new Date(oldestAttempt.attemptedAt.getTime() + CAMPAIGN_BATCH_INTERVAL_MS);
    await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { nextBatchAt } });
    await sleep(Math.max(1, nextBatchAt.getTime() - Date.now()));
    await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { nextBatchAt: null } });
  }
};

const processCampaign = async (campaignId) => {
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, companyId: true, subject: true, body: true, status: true, nextBatchAt: true },
  });
  if (!campaign || campaign.status !== 'SENDING') return;

  const pendingAt = campaign.nextBatchAt?.getTime() || 0;
  if (pendingAt > Date.now()) await sleep(pendingAt - Date.now());
  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { nextBatchAt: null },
  });

  const config = await readSmtpConfig(campaign.companyId);
  const attachments = await prisma.marketingCampaignAttachment.findMany({
    where: { campaignId },
    select: { filename: true, contentType: true, content: true },
  });
  const files = attachments.map((file) => ({
    originalname: file.filename,
    mimetype: file.contentType,
    buffer: file.content,
  }));
  const baseUrl = publicBaseUrl();
  const transport = smtpTransport(config.email, config.password);

  try {
    while (true) {
      const batch = await prisma.marketingCampaignRecipient.findMany({
        where: { campaignId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: CAMPAIGN_BATCH_SIZE,
        select: { id: true, leadId: true, email: true },
      });
      if (!batch.length) break;

      for (const recipient of batch) {
        const stillSubscribed = recipient.leadId
          ? await prisma.marketingLead.findFirst({
            where: { id: recipient.leadId, companyId: campaign.companyId, unsubscribedAt: null },
            select: { id: true },
          })
          : null;
        if (!stillSubscribed) {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SKIPPED', error: 'Lead unsubscribed before delivery.' },
          });
          continue;
        }

        await waitForCompanyCapacity(campaign.companyId, campaignId);
        const claimed = await prisma.marketingCampaignRecipient.updateMany({
          where: { id: recipient.id, status: 'PENDING' },
          data: { status: 'SENDING', attemptedAt: new Date() },
        });
        if (claimed.count === 0) continue;

        const unsubscribeUrl = `${baseUrl}/marketing/unsubscribe?token=${encodeURIComponent(signUnsubscribe(recipient.leadId, campaign.companyId))}`;
        try {
          await sendOne(transport, config, recipient.email, { subject: campaign.subject, body: campaign.body }, files, unsubscribeUrl);
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SENT', error: null, sentAt: new Date() },
          });
        } catch (error) {
          const message = String(error?.message || 'Email delivery failed.').replace(/[\r\n]+/g, ' ').slice(0, 500);
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED', error: message },
          });
        }
      }

      const remainingCount = await prisma.marketingCampaignRecipient.count({
        where: { campaignId, status: 'PENDING' },
      });
      if (remainingCount > 0) {
        const nextBatchAt = new Date(Date.now() + CAMPAIGN_BATCH_INTERVAL_MS);
        await prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: { nextBatchAt },
        });
        await setCampaignCountsAndStatus(campaignId);
        await sleep(CAMPAIGN_BATCH_INTERVAL_MS);
        await prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: { nextBatchAt: null },
        });
      }
    }
  } finally {
    transport.close();
  }
  await setCampaignCountsAndStatus(campaignId);
};

const drainCompanyQueue = async (companyId) => {
  while (true) {
    const nextCampaign = await prisma.marketingCampaign.findFirst({
      where: { companyId, status: 'SENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!nextCampaign) return;
    try {
      await processCampaign(nextCampaign.id);
    } catch (error) {
      const message = String(error?.message || 'Campaign could not continue.').replace(/[\r\n]+/g, ' ').slice(0, 500);
      logger.error(`Marketing campaign ${nextCampaign.id} stopped: ${message}`);
      await prisma.marketingCampaignRecipient.updateMany({
        where: { campaignId: nextCampaign.id, status: { in: ['PENDING', 'SENDING'] } },
        data: { status: 'FAILED', error: `Campaign worker stopped: ${message}` },
      });
      await setCampaignCountsAndStatus(nextCampaign.id, 'FAILED');
    }
  }
};

const scheduleCompanyQueue = (companyId) => {
  if (activeCompanyWorkers.has(companyId)) return;
  const worker = drainCompanyQueue(companyId)
    .catch((error) => {
      logger.error(`Marketing queue for company ${companyId} stopped: ${error?.stack || error}`);
    })
    .finally(() => {
      activeCompanyWorkers.delete(companyId);
    });
  activeCompanyWorkers.set(companyId, worker);
};

const resumeCampaigns = async () => {
  const interruptedRecipients = await prisma.marketingCampaignRecipient.updateMany({
    where: { status: 'SENDING', campaign: { status: 'SENDING' } },
    data: {
      status: 'FAILED',
      error: 'The backend restarted while delivery was in progress; delivery could not be confirmed.',
    },
  });
  if (interruptedRecipients.count) {
    logger.warn(`Marked ${interruptedRecipients.count} interrupted marketing email(s) as delivery-uncertain.`);
  }
  const companies = await prisma.marketingCampaign.findMany({
    where: { status: 'SENDING' },
    distinct: ['companyId'],
    select: { companyId: true },
  });
  companies.forEach(({ companyId }) => scheduleCompanyQueue(companyId));
};

const sendCampaign = async (user, { subject, body, confirmRecipientCount }, attachments = []) => {
  const companyId = companyIdFor(user);
  const cleanSubject = String(subject || '').trim();
  const cleanBody = String(body || '').trim();
  if (!cleanSubject || cleanSubject.length > 255 || /[\r\n]/.test(cleanSubject)) throw new BadRequestError('Subject is required, must not contain newlines, and must be at most 255 characters.');
  if (!cleanBody || cleanBody.length > 10000) throw new BadRequestError('Message is required (maximum 10,000 characters).');
  const leads = await prisma.marketingLead.findMany({
    where: { companyId, unsubscribedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
    take: MAX_CAMPAIGN_RECIPIENTS + 1,
  });
  if (!leads.length) throw new BadRequestError('There are no consented, subscribed leads to contact.');
  if (leads.length > MAX_CAMPAIGN_RECIPIENTS) {
    throw new BadRequestError(`A campaign can send to at most ${MAX_CAMPAIGN_RECIPIENTS} subscribed leads.`);
  }
  if (Number(confirmRecipientCount) !== leads.length) {
    throw new BadRequestError('The subscribed lead count changed. Review the recipient total and confirm the launch again.');
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, address: true, city: true, state: true, postalCode: true, country: true },
  });
  const mailingAddress = company?.address?.trim()
    || [company?.city, company?.state, company?.postalCode, company?.country].filter(Boolean).join(', ');
  if (!mailingAddress) {
    throw new BadRequestError('Add a physical mailing address in Company Profile before sending a marketing campaign.');
  }
  const baseUrl = publicBaseUrl();
  const messageBody = `${cleanBody}\n\n${company.name}\n${mailingAddress}`;

  await readSmtpConfig(companyId);
  const campaign = await prisma.marketingCampaign.create({
    data: {
      companyId,
      subject: cleanSubject,
      body: messageBody,
      status: 'SENDING',
      attachmentNames: attachments.map((file) => file.originalname.replace(/[\r\n"]/g, '_')),
      recipientCount: leads.length,
      createdById: user.id,
      recipients: { create: leads.map((lead) => ({ leadId: lead.id, email: lead.email, status: 'PENDING' })) },
      attachments: {
        create: attachments.map((file) => ({
          filename: file.originalname.replace(/[\r\n"]/g, '_'),
          contentType: file.mimetype,
          content: file.buffer,
        })),
      },
    },
    select: {
      id: true, mailType: true, subject: true, status: true, attachmentNames: true, recipientCount: true,
      sentCount: true, failedCount: true, skippedCount: true, nextBatchAt: true, createdAt: true, completedAt: true,
    },
  });
  scheduleCompanyQueue(companyId);
  return campaign;
};

const unsubscribe = async (token) => {
  const claims = verifyUnsubscribe(token);
  if (!claims) throw new BadRequestError('This unsubscribe link is invalid.');
  const lead = await prisma.marketingLead.findFirst({
    where: { id: claims.leadId, companyId: claims.companyId },
    select: { id: true, unsubscribedAt: true },
  });
  if (!lead) throw new NotFoundError('This unsubscribe link is no longer valid.');
  if (!lead.unsubscribedAt) {
    await prisma.marketingLead.update({ where: { id: lead.id }, data: { unsubscribedAt: new Date() } });
  }
  return { unsubscribed: true };
};

module.exports = {
  getSettings, saveSettings, addLead, importLeads, listLeads, listCampaigns,
  listCampaignRecipients, previewDirectMailRecipients, sendDirectMail,
  sendTest, sendCampaign, unsubscribe, resumeCampaigns,
};
