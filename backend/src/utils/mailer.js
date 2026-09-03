'use strict';

const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../common/logger');

/**
 * Gmail's SMTP address strips whitespace from the app password when you
 * copy it out of the Google Account UI, but people often paste it with
 * the spaces still in (e.g. "abcd efgh ijkl mnop"). Nodemailer usually
 * tolerates this, but stripping it here removes one class of "why won't
 * this authenticate" bug entirely.
 */
const cleanPassword = (value) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

const smtpConfig = {
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  user: config.smtp.user,
  password: cleanPassword(config.smtp.password),
  fromName: config.smtp.fromName,
  fromEmail: config.smtp.fromEmail,
};

/**
 * Fails loudly, at startup, for the two mistakes that most commonly
 * cause "the invitation is created but no email ever arrives":
 *   1. Missing SMTP config entirely.
 *   2. SMTP_FROM_EMAIL that doesn't match SMTP_USER (or its domain) —
 *      most providers (Gmail included) reject or silently mangle a send
 *      where the From header isn't the authenticated account or a
 *      verified alias on it, and the failure only shows up in the SMTP
 *      response, not in your application code.
 */
const validateSmtpConfig = () => {
  const missing = ['host', 'port', 'user', 'password', 'fromEmail', 'fromName'].filter(
    (key) => !smtpConfig[key]
  );
  if (missing.length) {
    logger.error(`Mailer: missing required SMTP config: ${missing.join(', ')}. Emails will not send.`);
    return false;
  }

  if (smtpConfig.fromEmail.toLowerCase() !== smtpConfig.user.toLowerCase()) {
    logger.warn(
      `Mailer: SMTP_FROM_EMAIL ("${smtpConfig.fromEmail}") does not match SMTP_USER ` +
        `("${smtpConfig.user}"). Most providers (including Gmail) will reject or mangle sends ` +
        `where the From address isn't the authenticated account or a verified alias on it. ` +
        `If mail silently isn't arriving, this is almost always why — set SMTP_FROM_EMAIL to ` +
        `the same address as SMTP_USER, or add it as a verified "Send mail as" alias in Gmail.`
    );
  }

  return true;
};

const configIsValid = validateSmtpConfig();

const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: {
    user: smtpConfig.user,
    pass: smtpConfig.password,
  },
});

// Fail fast in logs (not on boot) if SMTP creds/host are wrong — doesn't
// throw, just tells you early instead of on the first real send.
if (configIsValid) {
  transporter
    .verify()
    .then(() => logger.info('Mailer: SMTP connection verified'))
    .catch((err) => logger.error(`Mailer: SMTP verification failed — ${err.message}`));
}

const fromHeader = () => `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`;

/**
 * Generic send. Callers pass { to, subject, html, text? }.
 * Never throws-and-crashes the caller's main flow by itself — callers
 * (services) are expected to wrap this in try/catch if the email is
 * best-effort (e.g. don't block invitation creation if mail fails).
 */
const sendMail = async ({ to, subject, html, text, attachments, replyTo }) => {
  if (!to) {
    throw new Error('No recipient email provided');
  }
  if (!configIsValid) {
    throw new Error('SMTP is not configured correctly — see startup logs for the missing/invalid fields.');
  }

  const mailText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    const info = await transporter.sendMail({
      from: fromHeader(),
      to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      html,
      text: mailText,
      ...(attachments ? { attachments } : {}),
    });
    logger.info(`Mailer: sent "${subject}" to ${to} (messageId: ${info.messageId})`);
    return info;
  } catch (err) {
    logger.error(`Mailer: send failed to ${to} — ${err.message}`);
    throw err;
  }
};

/* ================================================================== */
/*  Shared email shell                                                  */
/*                                                                       */
/*  All templates below render through emailShell() so header, sign-off, */
/*  and footer stay visually consistent instead of being copy-pasted     */
/*  into every builder. Brand colours mirror the PDF report generator.   */
/* ================================================================== */

const BRAND_TEAL = '#3FDCC0';
const BRAND_INK = '#0B0F26';
const BRAND_HEADING = '#12172B';
const BRAND_MUTED = '#5B6280';
const BRAND_BORDER = '#E4E7F0';
const BRAND_WARNING = '#B45309';

const PLATFORM_LOGO_URL = `${config.frontendUrl.replace(/\/$/, '')}/hireverify-logo.svg`;

/**
 * `logoUrl` should be a fully-resolved absolute URL (e.g. a company's
 * uploaded logo already run through whatever asset-URL resolver you use
 * elsewhere in the app). Falls back to the HireVerify mark when no company
 * logo is available, so emails always render with *some* logo.
 */
const emailShell = ({ logoUrl, bodyHtml, signOffName, footerNote }) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 540px; margin: 0 auto; color: ${BRAND_HEADING}; line-height: 1.55;">
    <div style="text-align: center; padding: 8px 0 20px;">
      <img src="${logoUrl || PLATFORM_LOGO_URL}" alt="Logo" style="height: 42px; width: auto; display: inline-block;" />
    </div>
    <div style="background: #ffffff; border: 1px solid ${BRAND_BORDER}; border-radius: 12px; padding: 28px 30px;">
      ${bodyHtml}
      <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid ${BRAND_BORDER};">
        <p style="margin: 0; font-size: 14px; color: ${BRAND_HEADING};">Thanks and regards,</p>
        <p style="margin: 2px 0 0; font-size: 14px; font-weight: 700; color: ${BRAND_HEADING};">${signOffName}</p>
      </div>
    </div>
    ${
      footerNote
        ? `<p style="text-align:center; color:${BRAND_MUTED}; font-size: 11px; margin: 16px 8px 0;">${footerNote}</p>`
        : ''
    }
    <p style="text-align:center; color:${BRAND_MUTED}; font-size: 11px; margin: 6px 8px 0;">
      Powered by <span style="color:${BRAND_INK}; font-weight:600;">Hire</span><span style="color:#0E7C6B; font-weight:600;">Verify</span><br />
      <span style="color:${BRAND_MUTED};">BrainHunt Ventures</span>
    </p>
  </div>
`;

const ctaButton = (href, label) => `
  <a href="${href}" style="display:inline-block; background:${BRAND_TEAL}; color:${BRAND_INK}; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:700; font-size:14px; margin: 14px 0;">
    ${label}
  </a>
`;

const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const buildBgvReportsEmail = ({ clientName, companyName, reports }) => {
  const reportRows = reports.map((report) => `
    <tr>
      <td style="padding:10px 12px;border-top:1px solid ${BRAND_BORDER};font-size:13px;">${escapeHtml(report.candidateName)}</td>
      <td style="padding:10px 12px;border-top:1px solid ${BRAND_BORDER};font-size:13px;">${escapeHtml(report.caseNumber)}</td>
      <td style="padding:10px 12px;border-top:1px solid ${BRAND_BORDER};font-size:13px;">${escapeHtml(report.completedDate)}</td>
    </tr>`).join('');
  const countLabel = `${reports.length} completed background verification ${reports.length === 1 ? 'report is' : 'reports are'}`;
  return {
    subject: `${companyName} | ${countLabel} ready for review`,
    html: emailShell({
      bodyHtml: `<h2 style="margin:0 0 12px;font-size:20px;">Dear ${escapeHtml(clientName)} Team,</h2>
        <p style="margin:0 0 16px;font-size:14px;color:${BRAND_MUTED};">Please find attached ${countLabel} for your review. The reports contain the verified findings for the candidates listed below.</p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 18px;"><thead><tr style="background:#F5F7FA;"><th style="padding:10px 12px;text-align:left;font-size:12px;color:${BRAND_MUTED};">Candidate</th><th style="padding:10px 12px;text-align:left;font-size:12px;color:${BRAND_MUTED};">Case number</th><th style="padding:10px 12px;text-align:left;font-size:12px;color:${BRAND_MUTED};">Completed</th></tr></thead><tbody>${reportRows}</tbody></table>
        <p style="margin:0;font-size:14px;color:${BRAND_MUTED};">Please contact us if you need any clarification regarding these reports.</p>`,
      signOffName: companyName,
      footerNote: 'This email and its attachments are confidential and intended only for the recipient.',
    }),
  };
};

const infoRow = (label, value) => `
  <tr>
    <td style="padding:6px 14px 6px 0; color:${BRAND_MUTED}; font-size:13px; white-space:nowrap;">${label}</td>
    <td style="padding:6px 0; font-size:13px; font-weight:600;">${value}</td>
  </tr>
`;

/**
 * Company admin welcome email (referenced by user.service.js). Sent by the
 * platform when a new company admin account is created — accepts an
 * optional `companyLogoUrl` so the header shows the company's own branding
 * once they have a logo, rather than always the HireVerify mark.
 */
const buildCompanyAdminWelcomeEmail = ({ companyName, adminName, email, password, loginUrl, companyLogoUrl }) => ({
  subject: `Welcome to ${companyName} on HireVerify — your account is ready`,
  html: emailShell({
    logoUrl: companyLogoUrl,
    signOffName: 'The HireVerify Team',
    footerNote: `This account was created for you as an administrator of ${companyName} on the HireVerify platform.`,
    bodyHtml: `
      <h2 style="margin:0 0 6px; font-size:20px;">Welcome, ${adminName} 👋</h2>
      <p style="margin:0 0 16px; font-size:14px; color:${BRAND_MUTED};">
        Your administrator account for <strong>${companyName}</strong> has been created on HireVerify — the
        platform your team will use to manage background verification cases, verification checks, and
        authorized client reports.
      </p>
      <table style="margin: 4px 0 20px; border-collapse: collapse;">
        ${infoRow('Email', email)}
        ${infoRow('Temporary password', password)}
      </table>
      ${ctaButton(loginUrl, 'Log in to your dashboard')}
      <p style="margin:16px 0 0; font-size:12.5px; color:${BRAND_MUTED};">
        For security, you'll be asked to set a new password the first time you sign in. If the button
        above doesn't work, copy and paste this link into your browser:<br />
        <span style="word-break: break-all;">${loginUrl}</span>
      </p>
    `,
  }),
});

module.exports = {
  sendMail,
  buildCompanyAdminWelcomeEmail,
  buildBgvReportsEmail,
};