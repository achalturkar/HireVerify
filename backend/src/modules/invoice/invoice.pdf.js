'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../../config');

/* ------------------------------------------------------------------ */
/* Theme & layout constants                                            */
/* ------------------------------------------------------------------ */
const colors = {
  ink: '#16252C',
  muted: '#65747B',
  accent: '#147D72',
  accentDark: '#0E5F56',
  accentSoft: '#E4F2F0',
  line: '#D8E1E2',
  pale: '#F3F7F6',
  white: '#FFFFFF',
  green: '#1E8E5A',
  red: '#C0392B',
  amber: '#B7791F',
};

const resolveTheme = (value) => {
  const match = typeof value === 'string' && value.match(/^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i);
  if (!match) return colors;
  const digits = match[1] ? [...match[1]].map((digit) => `${digit}${digit}`).join('') : match[2];
  const accent = `#${digits}`.toUpperCase();
  const channels = digits.match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));
  const shade = channels.map((channel) => Math.round(channel * 0.72).toString(16).padStart(2, '0')).join('');
  const tint = channels.map((channel) => Math.round(channel * 0.12 + 255 * 0.88).toString(16).padStart(2, '0')).join('');
  return { ...colors, accent, accentDark: `#${shade}`, accentSoft: `#${tint}` };
};

const PAGE_W = 595.28;
const L = 48; // left margin
const R = 547; // right edge
const W = R - L; // content width (499)
const ROWS_BOTTOM = 748; // table rows must end above this
const BLOCK_BOTTOM = 768; // other blocks must end above this (footer line is at 792)

// Table columns (x = left edge of the text box, w = width)
const COL = {
  no: { x: 58, w: 20 },
  desc: { x: 84, w: 212 },
  qty: { x: 300, w: 38 },
  rate: { x: 342, w: 72 },
  tax: { x: 418, w: 38 },
  amt: { x: 460, w: 79 },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const num = (v) => Number(v || 0);
const fmt = (v) => num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (invoice, v) => `${invoice.currency || 'INR'} ${fmt(v)}`;
const date = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const hr = (doc, y, color = colors.line, x1 = L, x2 = R) =>
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(0.7).stroke();
const addressWithoutState = (address, state) => {
  if (!address || !state) return address || '';
  const normalizedState = state.trim().toLocaleLowerCase();
  return address.split(',').map((part) => part.trim()).filter((part) => part.toLocaleLowerCase() !== normalizedState).join(', ');
};

// Amount in words (Indian numbering) - used for INR invoices
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const below1000 = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? below100(r) : ''].filter(Boolean).join(' ');
};
const wordsOf = (n) => {
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${wordsOf(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
};
const amountInWords = (invoice, value) => {
  if ((invoice.currency || 'INR').toUpperCase() !== 'INR') return null;
  const total = Math.round(Math.abs(num(value)) * 100);
  const rupees = Math.floor(total / 100);
  const paise = total % 100;
  return `Rupees ${wordsOf(rupees)}${paise ? ` and ${below100(paise)} Paise` : ''} Only`;
};

const loadCompanyImage = async (url, box) => {
  if (!url || !String(url).startsWith('/uploads/companies/')) return null;
  const filePath = path.resolve(process.cwd(), config.upload.dir, 'companies', path.basename(url));
  if (!fs.existsSync(filePath)) return null;
  try {
    return await sharp(filePath).resize({ ...box, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch (_error) {
    return null;
  }
};
const loadLogo = (url) => loadCompanyImage(url, { width: 520, height: 220 });
const loadSignature = (url) => loadCompanyImage(url, { width: 300, height: 100 });

const paymentStatus = (invoice) => {
  const balance = invoice.balanceDue ?? invoice.total;
  if (num(balance) <= 0 && num(invoice.total) > 0) return { label: 'PAID', color: colors.green };
  if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) return { label: 'OVERDUE', color: colors.red };
  if (num(invoice.amountPaid) > 0) return { label: 'PARTIALLY PAID', color: colors.amber };
  return { label: 'PAYMENT DUE', color: colors.amber };
};

/* ------------------------------------------------------------------ */
/* Drawing blocks                                                      */
/* ------------------------------------------------------------------ */
const drawTopBand = (doc, theme) => {
  doc.rect(0, 0, PAGE_W, 9).fill(theme.accent);
  doc.rect(0, 9, PAGE_W, 2).fill(theme.accentSoft);
};

const drawHeader = (doc, invoice, logo, theme) => {
  drawTopBand(doc, theme);

  if (logo) {
    doc.image(logo, L, 30, { fit: [150, 52], valign: 'top' });
  } else {
    doc.fillColor(theme.accent).font('Helvetica-Bold').fontSize(16)
      .text(invoice.supplierName || '', L, 36, { width: 260, lineGap: 2 });
  }

  doc.fillColor(theme.accent).font('Helvetica-Bold').fontSize(21)
    .text('INVOICE', 335, 28, { width: R - 335, align: 'right', characterSpacing: 1.5 });
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10.5)
    .text(`# ${invoice.invoiceNumber || ''}`, 335, 61, { width: R - 335, align: 'right' });

  // status pill
  const status = paymentStatus(invoice);
  doc.font('Helvetica-Bold').fontSize(7);
  const pillW = doc.widthOfString(status.label, { characterSpacing: 0.8 }) + 22;
  doc.roundedRect(R - pillW, 79, pillW, 15, 7.5).fill(status.color);
  doc.fillColor(colors.white).text(status.label, R - pillW, 83.5, { width: pillW, align: 'center', characterSpacing: 0.8 });

  // meta strip
  const y = 104;
  const cells = [
    ['ISSUE DATE', date(invoice.invoiceDate)],
    ['DUE DATE', date(invoice.dueDate)],
    ['PLACE OF SUPPLY', invoice.placeOfSupply || '-'],
    ['CURRENCY', invoice.currency || 'INR'],
    ['PO NUMBER', invoice.purchaseOrderNumber || '-'],
  ];
  doc.roundedRect(L, y, W, 38, 6).fill(colors.pale);
  const cw = W / cells.length;
  cells.forEach(([label, value], i) => {
    const x = L + i * cw;
    if (i > 0) doc.moveTo(x, y + 8).lineTo(x, y + 30).strokeColor(colors.line).lineWidth(0.8).stroke();
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(6.5).text(label, x + 12, y + 8, { width: cw - 18, characterSpacing: 0.6, lineBreak: false });
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(9).text(value, x + 12, y + 20, { width: cw - 18, lineBreak: false, ellipsis: true });
  });
  return y + 38;
};

const drawParty = (doc, { x, y, w, label, name, address, lines, theme }) => {
  doc.rect(x, y, 3, 10).fill(theme.accent);
  doc.fillColor(theme.accent).font('Helvetica-Bold').fontSize(7.5).text(label, x + 10, y + 1.5, { characterSpacing: 0.8 });
  hr(doc, y + 16, theme.line, x, x + w);

  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10.5).text(name || '-', x, y + 22, { width: w, align: 'left' });
  if (address) doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(address, x, doc.y + 2, { width: w, lineGap: 2, align: 'left' });
  if (lines.length) {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(lines.join('\n'), x, doc.y + 4, { width: w, lineGap: 2, align: 'left' });
  }
  return doc.y;
};

const drawParties = (doc, invoice, y, theme) => {
  const colW = 236;
  const fromEnd = drawParty(doc, {
    x: L, y, w: colW, label: 'FROM',
    name: invoice.supplierName,
    address: addressWithoutState(invoice.supplierAddress, invoice.supplierState),
    theme,
    lines: [
      invoice.supplierState && `State: ${invoice.supplierState}`,
      invoice.supplierGst && `GSTIN: ${invoice.supplierGst}`,
    ].filter(Boolean),
  });

  // Bill To: company name, address, state and GST number only
  const billName = invoice.clientName || invoice.billToName || invoice.candidateName;
  const state = invoice.clientState || invoice.placeOfSupply;
  const toEnd = drawParty(doc, {
    x: R - colW, y, w: colW, label: 'BILL TO',
    name: billName,
    address: addressWithoutState(invoice.clientAddress, state),
    theme,
    lines: [
      state && `State: ${state}`,
      invoice.clientGst && `GSTIN: ${invoice.clientGst}`,
    ].filter(Boolean),
  });
  return Math.max(fromEnd, toEnd);
};

const drawTableHeader = (doc, y, theme) => {
  doc.roundedRect(L, y, W, 24, 4).fill(theme.accent);
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(7.5);
  const t = (label, c, align) => doc.text(label, c.x, y + 8, { width: c.w, align, characterSpacing: 0.6, lineBreak: false });
  t('#', COL.no, 'left');
  t('DESCRIPTION', COL.desc, 'left');
  t('QTY', COL.qty, 'right');
  t('RATE', COL.rate, 'right');
  t('TAX', COL.tax, 'right');
  t('AMOUNT', COL.amt, 'right');
  return y + 24;
};

const drawContinuationHeader = (doc, invoice, theme) => {
  drawTopBand(doc, theme);
  doc.fillColor(theme.accent).font('Helvetica-Bold').fontSize(12).text(`Invoice ${invoice.invoiceNumber || ''}`, L, 30);
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text('(continued)', L, 46);
  return 68;
};

const itemDescription = (item) => {
  const title = item.description || item.title || '-';
  const subs = [];
  if (item.candidateName) subs.push(`Candidate: ${item.candidateName}`);
  if (item.serviceCode) subs.push(`Service code: ${item.serviceCode}`);
  return { title, sub: subs.join('   ·   ') };
};

const measureItemRow = (doc, item) => {
  const { title, sub } = itemDescription(item);
  doc.font('Helvetica-Bold').fontSize(9);
  const titleH = doc.heightOfString(title, { width: COL.desc.w, lineGap: 1.5 });
  doc.font('Helvetica').fontSize(7.5);
  const subH = sub ? doc.heightOfString(sub, { width: COL.desc.w, lineGap: 1.5 }) + 2 : 0;
  return { title, sub, titleH, rowH: Math.max(26, titleH + subH + 14) };
};

const drawItems = (doc, invoice, startY, theme) => {
  const items = invoice.items || [];
  if (items.length && startY + 24 + measureItemRow(doc, items[0]).rowH > ROWS_BOTTOM) {
    doc.addPage();
    startY = drawContinuationHeader(doc, invoice, theme) + 4;
  }
  let y = drawTableHeader(doc, startY, theme);

  items.forEach((item, index) => {
    const { title, sub, titleH, rowH } = measureItemRow(doc, item);

    if (y + rowH > ROWS_BOTTOM) {
      doc.addPage();
      y = drawTableHeader(doc, drawContinuationHeader(doc, invoice, theme), theme);
    }

    if (index % 2 === 1) doc.rect(L, y, W, rowH).fill(colors.pale);

    const ty = y + 7;
    doc.fillColor(colors.muted).font('Helvetica').fontSize(9).text(String(index + 1), COL.no.x, ty, { width: COL.no.w, lineBreak: false });
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(9).text(title, COL.desc.x, ty, { width: COL.desc.w, lineGap: 1.5 });
    if (sub) {
      doc.fillColor(colors.muted).font('Helvetica').fontSize(7.5).text(sub, COL.desc.x, ty + titleH + 2, { width: COL.desc.w, lineGap: 1.5 });
    }

    const qty = num(item.quantity);
    const unit = num(item.unitPrice);
    const lineTotal = item.total ?? qty * unit;
    doc.fillColor(colors.ink).font('Helvetica').fontSize(9);
    doc.text(qty.toLocaleString('en-IN'), COL.qty.x, ty, { width: COL.qty.w, align: 'right', lineBreak: false });
    doc.text(fmt(unit), COL.rate.x, ty, { width: COL.rate.w, align: 'right', lineBreak: false });
    doc.text(`${num(item.taxPercent)}%`, COL.tax.x, ty, { width: COL.tax.w, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').text(fmt(lineTotal), COL.amt.x, ty, { width: COL.amt.w, align: 'right', lineBreak: false });

    y += rowH;
    hr(doc, y);
  });

  return y;
};

const drawTotals = (doc, invoice, startY, theme) => {
  const rows = [['Subtotal', num(invoice.subtotal)]];
  if (num(invoice.discountTotal) > 0) rows.push(['Discount', -num(invoice.discountTotal)]);
  if (invoice.taxType === 'CGST_SGST') {
    rows.push(['CGST', num(invoice.taxTotal) / 2], ['SGST', num(invoice.taxTotal) / 2]);
  } else if (invoice.taxType === 'IGST') {
    rows.push(['IGST', num(invoice.taxTotal)]);
  } else if (num(invoice.taxTotal) > 0) {
    rows.push(['Tax', num(invoice.taxTotal)]);
  }
  const balance = invoice.balanceDue ?? invoice.total;
  const hasPaid = num(invoice.amountPaid) > 0;

  const boxH = 4 + rows.length * 16 + 10 + 20 + (hasPaid ? 18 : 0) + 2 + 32;
  let y = startY + 12;
  if (y + boxH > BLOCK_BOTTOM) {
    doc.addPage();
    y = drawContinuationHeader(doc, invoice, theme) + 4;
  }
  const top = y;
  const bx = 322;
  const bw = R - bx;

  const words = amountInWords(invoice, invoice.total);
  if (words) {
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(7).text('AMOUNT IN WORDS', L, top + 4, { characterSpacing: 0.6 });
    doc.fillColor(colors.ink).font('Helvetica-Oblique').fontSize(8.5).text(words, L, top + 16, { width: 250, lineGap: 2 });
  }

  y += 4;
  rows.forEach(([label, value]) => {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(label, bx + 12, y, { width: 100, lineBreak: false });
    doc.fillColor(colors.ink).font('Helvetica').fontSize(8.5).text(money(invoice, value), bx + 100, y, { width: bw - 112, align: 'right', lineBreak: false });
    y += 16;
  });
  y += 1;
  hr(doc, y, colors.line, bx + 12, R - 12);
  y += 8;
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(10).text('Invoice total', bx + 12, y, { width: 100, lineBreak: false });
  doc.text(money(invoice, invoice.total), bx + 100, y, { width: bw - 112, align: 'right', lineBreak: false });
  y += 20;
  if (hasPaid) {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text('Amount paid', bx + 12, y, { width: 100, lineBreak: false });
    doc.fillColor(colors.green).text(`- ${money(invoice, invoice.amountPaid)}`, bx + 100, y, { width: bw - 112, align: 'right', lineBreak: false });
    y += 18;
  }
  y += 2;
  doc.roundedRect(bx, y, bw, 30, 5).fill(theme.accent);
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(8.5).text('BALANCE DUE', bx + 12, y + 11.5, { width: 80, characterSpacing: 0.6, lineBreak: false });
  doc.fontSize(12).text(money(invoice, balance), bx + 90, y + 9.5, { width: bw - 102, align: 'right', lineBreak: false });
  return Math.max(y + 30, top + 50);
};

const bankList = (invoice) => [
  ['Account name', invoice.supplierBankAccountName],
  ['Bank', invoice.supplierBankName],
  ['Account number', invoice.supplierBankAccountNumber],
  ['IFSC', invoice.supplierBankIfscCode],
  ['SWIFT / BIC', invoice.supplierBankSwiftCode],
  ['Branch', invoice.supplierBankBranch],
  ['UPI', invoice.supplierUpiId],
].filter(([, v]) => v);

const drawPaymentCard = (doc, details, x, y, w, cols, theme) => {
  const h = 28 + Math.ceil(details.length / cols) * 23 + 2;
  doc.roundedRect(x, y, w, h, 6).fill(theme.accentSoft);
  doc.rect(x, y + 6, 3, h - 12).fill(theme.accent);
  doc.fillColor(theme.accentDark).font('Helvetica-Bold').fontSize(7.5).text('PAYMENT DETAILS', x + 14, y + 9, { characterSpacing: 0.8, lineBreak: false });
  const cw = (w - 22) / cols;
  details.forEach(([label, value], i) => {
    const cx = x + 14 + (i % cols) * cw;
    const cy = y + 25 + Math.floor(i / cols) * 23;
    doc.fillColor(colors.muted).font('Helvetica').fontSize(7).text(label, cx, cy, { width: cw - 8, lineBreak: false });
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(8.5).text(String(value), cx, cy + 9, { width: cw - 8, lineBreak: false, ellipsis: true });
  });
  return h;
};

const drawSignatory = (doc, invoice, signature, x, y, w, theme) => {
  doc.fillColor(theme.accentDark).font('Helvetica-Bold').fontSize(8)
    .text(`For ${invoice.supplierName || 'Company'}`, x, y, { width: w, align: 'right', lineBreak: false, ellipsis: true });
  const imgH = signature ? 40 : 0;
  if (signature) doc.image(signature, x + w - 150, y + 12, { fit: [150, imgH], align: 'right', valign: 'bottom' });
  const lineY = y + (signature ? 12 + imgH + 3 : 30);
  hr(doc, lineY, colors.line, x + 25, x + w);
  if (invoice.supplierAdminName) {
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(8.5)
      .text(invoice.supplierAdminName, x, lineY + 5, { width: w, align: 'right', lineBreak: false, ellipsis: true });
  }
  doc.fillColor(colors.muted).font('Helvetica').fontSize(7.5)
    .text('Authorized Signatory', x, lineY + (invoice.supplierAdminName ? 17 : 5), { width: w, align: 'right', lineBreak: false });
  return lineY + (invoice.supplierAdminName ? 28 : 16) - y;
};

// Payment details (left) and authorised signatory (right) share one row to save vertical space
const drawBottomBlock = (doc, invoice, signature, startY, theme) => {
  const details = bankList(invoice);
  const hasSign = Boolean(signature || invoice.supplierAdminName);
  if (!details.length && !hasSign) return startY;

  const cols = hasSign ? 2 : 3;
  const bankW = hasSign ? 292 : W;
  const bankH = details.length ? 30 + Math.ceil(details.length / cols) * 23 : 0;
  const signH = hasSign ? (signature ? 86 : 58) : 0;
  const blockH = Math.max(bankH, signH);

  let y = startY + 14;
  if (y + blockH > BLOCK_BOTTOM) {
    doc.addPage();
    y = drawContinuationHeader(doc, invoice, theme) + 4;
  }
  let h1 = 0;
  let h2 = 0;
  if (details.length) h1 = drawPaymentCard(doc, details, L, y, bankW, cols, theme);
  if (hasSign) h2 = drawSignatory(doc, invoice, signature, R - 190, y + 2, 190, theme);
  return y + Math.max(h1, h2);
};

// Notes and payment terms sit side by side when both exist (saves vertical space)
const drawNotesAndTerms = (doc, invoice, startY, theme) => {
  const blocks = [['Notes', invoice.notes], ['Payment terms', invoice.terms]].filter(([, body]) => body);
  if (!blocks.length) return startY;
  const colW = blocks.length === 2 ? 240 : W;
  doc.font('Helvetica').fontSize(8);
  const h = Math.max(...blocks.map(([, body]) => doc.heightOfString(String(body), { width: colW, lineGap: 2 }))) + 14;
  let y = startY + 12;
  if (y + h > BLOCK_BOTTOM) {
    doc.addPage();
    y = drawContinuationHeader(doc, invoice, theme) + 4;
  }
  blocks.forEach(([title, body], i) => {
    const x = L + i * (colW + 19);
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(8.5).text(title, x, y, { lineBreak: false });
    doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text(String(body), x, y + 12, { width: colW, lineGap: 2 });
  });
  return y + h;
};

const drawFooters = (doc, invoice) => {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i += 1) {
    doc.switchToPage(pages.start + i);
    // avoid pdfkit auto-adding a page when writing into the bottom margin
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    hr(doc, 792);
    doc.fillColor(colors.muted).font('Helvetica').fontSize(7.5);
    doc.text(`${invoice.supplierName || ''}  ·  ${invoice.invoiceNumber || ''}`, L, 801, { width: 260, lineBreak: false });
    doc.text('This is a computer-generated invoice.', 200, 801, { width: 195, align: 'center', lineBreak: false });
    doc.text(`Page ${i + 1} of ${pages.count}`, 400, 801, { width: R - 400, align: 'right', lineBreak: false });
    doc.page.margins.bottom = prevBottom;
  }
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
const buildInvoicePdf = async (invoice) => {
  const [logo, signature] = await Promise.all([loadLogo(invoice.supplierLogoUrl), loadSignature(invoice.supplierSignatureUrl)]);
  const theme = resolveTheme(invoice.supplierPrimaryColor);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: {
        Title: `Invoice ${invoice.invoiceNumber || ''}`,
        Author: invoice.supplierName || '',
        Subject: `Invoice for ${invoice.clientName || invoice.candidateName || ''}`,
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const headerEnd = drawHeader(doc, invoice, logo, theme);
      const partiesEnd = drawParties(doc, invoice, headerEnd + 18, theme);
      let y = drawItems(doc, invoice, partiesEnd + 18, theme);
      y = drawTotals(doc, invoice, y, theme);
      y = drawBottomBlock(doc, invoice, signature, y, theme);
      drawNotesAndTerms(doc, invoice, y, theme);
      drawFooters(doc, invoice);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { buildInvoicePdf };