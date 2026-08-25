'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/* ================================================================== */
/*  Layout constants                                                    */
/* ================================================================== */

const PAGE_LEFT = 48;
const PAGE_WIDTH = 499; // usable content width (A4 minus 48pt margins each side)
const FOOTER_Y = 770;
const CONTENT_BOTTOM = 735; // ensureSpace threshold before the footer rule

const COLORS = {
  navy: '#1F417A', // main section bands, label text
  subhead: '#3E5C86', // DETAILS/FINDINGS + table header rows — deliberately lighter
  // than the navy bands so the two-tier hierarchy (section band > column
  // header) is visually distinct, matching the sample report.
  labelBg: '#F4F6F8',
  valueBg: '#FFFFFF',
  border: '#D0D5DD',
  body: '#101828',
  muted: '#667085',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
  gray: '#667085',
};

const hexColor = (value) => {
  const match = String(value || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((part) => part + part).join('') : match[1];
  return `#${hex.toUpperCase()}`;
};

const mixColor = (first, second, secondWeight) => {
  const toRgb = (color) => [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const firstRgb = toRgb(first);
  const secondRgb = toRgb(second);
  return `#${firstRgb.map((value, index) => Math.round(value + (secondRgb[index] - value) * secondWeight).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

const reportColors = (primaryColor) => {
  const primary = hexColor(primaryColor);
  if (!primary) return COLORS;
  const rgb = [1, 3, 5].map((offset) => parseInt(primary.slice(offset, offset + 2), 16));
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const navy = luminance > 0.58 ? mixColor(primary, '#000000', 0.35) : primary;
  return { ...COLORS, navy, subhead: mixColor(navy, '#FFFFFF', 0.2) };
};

const colorsFor = (doc) => doc.reportColors || COLORS;

const REPORT_CHECK_ORDER = ['IDENTITY', 'ADDRESS', 'UAN', 'EDUCATION', 'COURT', 'CIBIL', 'TWENTY_SIX_AS', 'POLICE', 'PAN', 'EMPLOYMENT', 'DOCUMENT', 'DOCUMENT_FORGERY'];

/* ================================================================== */
/*  Asset loading                                                       */
/* ================================================================== */

const readAsset = (assetUrl) =>
  new Promise((resolve) => {
    if (!assetUrl) return resolve(null);
    if (!/^https?:\/\//i.test(assetUrl)) {
      const localPath = path.resolve(process.cwd(), assetUrl.replace(/^\//, ''));
      return resolve(fs.existsSync(localPath) ? localPath : null);
    }
    const client = assetUrl.startsWith('https://') ? https : http;
    const request = client.get(assetUrl, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) return resolve(null);
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.on('error', () => resolve(null));
    request.setTimeout(5000, () => {
      request.destroy();
      resolve(null);
    });
  });

const renderPdfPages = async (asset) => {
  const { PDFDocument, Matrix, ColorSpace } = await import('mupdf');
  const pdf = PDFDocument.openDocument(Buffer.isBuffer(asset) ? asset : fs.readFileSync(asset));
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.countPages(); pageNumber += 1) {
    const page = pdf.loadPage(pageNumber - 1);
    pages.push(Buffer.from(page.toPixmap(Matrix.scale(1.5, 1.5), ColorSpace.DeviceRGB).asJPEG(90)));
  }
  return pages;
};

/* ================================================================== */
/*  Formatting helpers                                                  */
/* ================================================================== */

/**
 * Maps a status string to one of the four classification colors defined
 * by the report's own "Classification of Report Status" band. The old
 * code only ever rendered green or red — anything that wasn't CLEAR fell
 * through to red, which is wrong for MINOR DISCREPANCY (amber) and
 * UNABLE TO VERIFY (gray).
 */
const statusColor = (value) => {
  const normalized = String(value || '').toUpperCase().replaceAll('_', ' ');
  if (normalized.includes('MAJOR')) return COLORS.red;
  if (normalized.includes('MINOR')) return COLORS.amber;
  if (normalized.includes('UNABLE')) return COLORS.gray;
  if (['CLEAR', 'VERIFIED', 'COMPLETED'].some((s) => normalized.includes(s))) return COLORS.green;
  return COLORS.gray;
};

const reportStatus = (value) => {
  const normalized = String(value || 'PENDING').toUpperCase().replaceAll('_', ' ');
  return ['VERIFIED', 'CLEAR', 'COMPLETED'].includes(normalized) ? 'CLEAR' : normalized;
};

const reportDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const formatLabel = (key) =>
  key.replaceAll(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());

/* ================================================================== */
/*  Low-level drawing primitives                                        */
/* ================================================================== */

/** Full-width navy section band, e.g. "CANDIDATE VERIFICATION INFORMATION". */
const drawBand = (doc, title, color) => {
  const colors = colorsFor(doc);
  color ||= colors.navy;
  const y = doc.y;
  doc.fillColor(color).rect(PAGE_LEFT, y, PAGE_WIDTH, 26).fill();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(title, PAGE_LEFT + 10, y + 7, {
    width: PAGE_WIDTH - 20,
    align: 'center',
  });
  doc.y = y + 26 ; // keep the following content close to the section header
};

/** A column-header row (e.g. "DETAILS | FINDINGS" or the 3-col Executive Summary header). */
const drawHeaderRow = (doc, columns, widths) => {
  const y = doc.y;
  const height = 24;
  let x = PAGE_LEFT;
  columns.forEach((label, i) => {
    doc.fillColor(colorsFor(doc).subhead).rect(x, y, widths[i], height).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(label, x + 6, y + 7, {
      width: widths[i] - 12,
      align: i === 0 ? 'left' : 'center',
    });
    x += widths[i];
  });
  doc.strokeColor(colorsFor(doc).border).rect(PAGE_LEFT, y, PAGE_WIDTH, height).stroke();
  doc.y = y + height;
};

/**
 * A single label/value row. If `status` is passed, the value cell is
 * filled with statusColor(status) and the text goes white/bold instead
 * of the normal label/value styling — used for every "Status" row and
 * for the Executive Summary's per-check status column.
 */
const drawRow = (doc, label, value, { status, labelWidth = 245, valueBold = false } = {}) => {
  const colors = colorsFor(doc);
  const valueWidth = PAGE_WIDTH - labelWidth;
  const y = doc.y;

  // Measure BOTH the label and the value — the old version only measured
  // the value's wrapped height, so a long label (e.g. "DATE OF
  // COMPLETION") that wrapped to two lines got a row sized for one line
  // and its second line spilled past the cell border.
  doc.font('Helvetica-Bold').fontSize(9.5);
  const labelHeight = doc.heightOfString(String(label), { width: labelWidth - 16 }) + 12;
  doc.font('Helvetica').fontSize(9.5);
  const valueHeight = doc.heightOfString(String(value ?? '-'), { width: valueWidth - 18 }) + 12;
  const height = Math.max(24, labelHeight, valueHeight);

  doc.fillColor(colors.labelBg).rect(PAGE_LEFT, y, labelWidth, height).fill();
  const valueBg = status ? statusColor(status) : colors.valueBg;
  doc.fillColor(valueBg).rect(PAGE_LEFT + labelWidth, y, valueWidth, height).fill();
  doc.strokeColor(colors.border).rect(PAGE_LEFT, y, PAGE_WIDTH, height).stroke();

  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(9.5).text(label, PAGE_LEFT + 8, y + 7, {
    width: labelWidth - 16,
  });
  doc
    .fillColor(status ? '#FFFFFF' : colors.body)
    .font(status || valueBold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(9.5)
    .text(String(value ?? '-'), PAGE_LEFT + labelWidth + 9, y + 7, { width: valueWidth - 18 });

  doc.y = y + height;
};

/** A row holding TWO label/value pairs side by side — used for the
 *  Candidate Verification Information table's paired fields (GENDER +
 *  DATE OF BIRTH on one row, etc). The old drawTable had no way to
 *  express this and could only render one full-width pair per row.
 */
const drawPairedRow = (doc, left, right) => {
  const colors = colorsFor(doc);
  const colWidths = [130, 120, 130, 119]; // sums to 499 — labels widened from 120→130 so long
  // labels like "DATE OF COMPLETION" are less likely to wrap in the first place.
  const y = doc.y;

  // Measure every one of the four cells — the old version only measured
  // the two value cells, so a wrapped label (bold, narrower column) could
  // be taller than the row height it was given and get clipped.
  doc.font('Helvetica-Bold').fontSize(9.5);
  const leftLabelH = doc.heightOfString(String(left.label), { width: colWidths[0] - 16 }) + 12;
  const rightLabelH = doc.heightOfString(String(right.label), { width: colWidths[2] - 16 }) + 12;
  doc.font('Helvetica').fontSize(9.5);
  const leftValueH = doc.heightOfString(String(left.value ?? '-'), { width: colWidths[1] - 16 }) + 12;
  const rightValueH = doc.heightOfString(String(right.value ?? '-'), { width: colWidths[3] - 16 }) + 12;
  const height = Math.max(24, leftLabelH, rightLabelH, leftValueH, rightValueH);

  let x = PAGE_LEFT;
  const cells = [
    { text: left.label, bg: colors.labelBg, textColor: colors.navy, bold: true },
    { text: left.value, bg: colors.valueBg, textColor: colors.body, bold: false },
    { text: right.label, bg: colors.labelBg, textColor: colors.navy, bold: true },
    { text: right.value, bg: right.status ? statusColor(right.status) : colors.valueBg, textColor: right.status ? '#FFFFFF' : colors.body, bold: Boolean(right.status) },
  ];

  cells.forEach((cell, i) => {
    doc.fillColor(cell.bg ?? colors.valueBg).rect(x, y, colWidths[i], height).fill();
    doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(cell.textColor);
    doc.text(String(cell.text ?? '-'), x + 8, y + 7, { width: colWidths[i] - 16 });
    x += colWidths[i];
  });

  doc.strokeColor(colors.border).rect(PAGE_LEFT, y, PAGE_WIDTH, height).stroke();
  let dividerX = PAGE_LEFT;
  colWidths.slice(0, -1).forEach((w) => {
    dividerX += w;
    doc.strokeColor(colors.border).moveTo(dividerX, y).lineTo(dividerX, y + height).stroke();
  });

  doc.y = y + height;
};

/** Full-width single row (used for NAME OF CANDIDATE, which spans the whole table width). */
const drawFullRow = (doc, label, value) => {
  const colors = colorsFor(doc);
  const labelWidth = 130;
  const valueWidth = PAGE_WIDTH - labelWidth;
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5);
  const labelHeight = doc.heightOfString(String(label), { width: labelWidth - 16 }) + 12;
  doc.font('Helvetica').fontSize(9.5);
  const valueHeight = doc.heightOfString(String(value ?? '-'), { width: valueWidth - 16 }) + 12;
  const height = Math.max(24, labelHeight, valueHeight);

  doc.fillColor(colors.labelBg).rect(PAGE_LEFT, y, labelWidth, height).fill();
  doc.fillColor(colors.valueBg).rect(PAGE_LEFT + labelWidth, y, valueWidth, height).fill();
  doc.strokeColor(colors.border).rect(PAGE_LEFT, y, PAGE_WIDTH, height).stroke();
  doc.strokeColor(colors.border).moveTo(PAGE_LEFT + labelWidth, y).lineTo(PAGE_LEFT + labelWidth, y + height).stroke();
  doc.fillColor(colors.navy).font('Helvetica-Bold').fontSize(9.5).text(label, PAGE_LEFT + 8, y + 7, { width: labelWidth - 16 });
  doc.fillColor(colors.body).font('Helvetica-Bold').fontSize(9.5).text(String(value ?? '-'), PAGE_LEFT + labelWidth + 8, y + 7, { width: valueWidth - 16 });
  doc.y = y + height;
};

const drawFooter = (doc, companyName) => {
  const colors = colorsFor(doc);
  doc.save().strokeColor('#CBD5E1').moveTo(PAGE_LEFT, FOOTER_Y).lineTo(547, FOOTER_Y).stroke();
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8).text(`Confidential - ${companyName} - All rights reserved`, PAGE_LEFT, FOOTER_Y + 8, { width: PAGE_WIDTH, align: 'center' });
  doc.restore();
};

const drawPageChrome = (doc, logo) => {
  if (logo) doc.image(logo, 485, 35, { fit: [60, 60], align: 'right' });
  doc.y = 100; // was 105 — tighter top gap; logo (35 + up to 60 tall) still clears this comfortably
};

/** Breaks to a fresh page (with logo + footer handled) only if `requiredHeight` won't fit before the footer. */
const ensureSpace = (doc, requiredHeight, companyName, logo) => {
  if (doc.y + requiredHeight <= CONTENT_BOTTOM) return;
  drawFooter(doc, companyName);
  doc.addPage();
  drawPageChrome(doc, logo);
};

/* ================================================================== */
/*  Section builders                                                    */
/* ================================================================== */

const resultData = (check) => (check.resultData && typeof check.resultData === 'object' ? check.resultData : {});

const orderedChecks = (checks) => checks
  .map((check, index) => ({ check, index }))
  .sort((left, right) => {
    const leftOrder = REPORT_CHECK_ORDER.indexOf(left.check.type);
    const rightOrder = REPORT_CHECK_ORDER.indexOf(right.check.type);
    return (leftOrder === -1 ? REPORT_CHECK_ORDER.length : leftOrder)
      - (rightOrder === -1 ? REPORT_CHECK_ORDER.length : rightOrder) || left.index - right.index;
  })
  .map(({ check }) => check)
  .filter((check) => REPORT_CHECK_ORDER.includes(check.type));

const overallVerificationStatus = (checks, fallback) => {
  const statuses = checks.map((check) => reportStatus(checkStatus(check)));
  if (statuses.some((status) => status === 'MAJOR DISCREPANCY')) return 'MAJOR DISCREPANCY';
  if (statuses.some((status) => status === 'MINOR DISCREPANCY')) return 'MINOR DISCREPANCY';
  if (statuses.some((status) => status === 'UNABLE TO VERIFY')) return 'UNABLE TO VERIFY';
  if (statuses.some((status) => status === 'REQUIRES REVIEW')) return 'REQUIRES REVIEW';
  if (statuses.length && statuses.every((status) => status === 'CLEAR')) return 'CLEAR';
  return reportStatus(fallback);
};

const fieldValue = (source, key, fallback = '-') => {
  const value = source[key];
  return value === undefined || value === null || value === '' ? fallback : value;
};

const checkStatus = (check, source = resultData(check)) =>
  fieldValue(source, 'status', fieldValue(source, 'outcome', check.result || check.status || 'PENDING'));

const commonRows = (source, check, { includeStatus = true } = {}) => {
  const rows = [
    ['Verified By', fieldValue(source, 'verifiedBy', fieldValue(source, 'verifierName'))],
    ['Mode of Verification', fieldValue(source, 'modeOfVerification')],
    ['Remarks', fieldValue(source, 'remarks', fieldValue(check, 'remarks'))],
  ];
  if (includeStatus) rows.push(['Status', reportStatus(checkStatus(check, source))]);
  return rows;
};

const rowsForFields = (source, fields) => fields
  .filter(({ key }) => source[key] !== undefined && source[key] !== null && source[key] !== '' && typeof source[key] !== 'object')
  .map(({ key, label }) => [label, source[key]]);

const firstAvailableField = (source, fields) => {
  const field = fields.find(({ key }) => source[key] !== undefined && source[key] !== null && source[key] !== '' && typeof source[key] !== 'object');
  return field ? [[field.label, source[field.key]]] : [];
};

const summaryDetail = (check) => {
  const data = resultData(check);
  const detailFields = {
    IDENTITY: [{ key: 'aadhaarNumber', label: 'Aadhar Card Verified' }],
    ADDRESS: [{ key: 'permanentAddress', label: 'Pan Card Address Verified' }, { key: 'currentAddress', label: 'Address Verified' }],
    UAN: [{ key: 'uanNumber', label: 'UAN Verified' }, { key: 'uan', label: 'UAN Verified' }],
    CIBIL: [{ key: 'creditScore', label: 'CIBIL Score Verified' }, { key: 'score', label: 'CIBIL Score Verified' }],
    TWENTY_SIX_AS: [{ key: 'assessmentYear', label: '26AS Verified' }, { key: 'taxStatus', label: '26AS Verified' }],
    POLICE: [{ key: 'policeStation', label: 'Police Verification Completed' }, { key: 'verificationStatus', label: 'Police Verification Completed' }],
    EDUCATION: [{ key: 'documentName', label: 'Document Verified' }, { key: 'educationType', label: 'Document Verified' }],
    COURT: [{ key: 'remarks', label: null }],
  };
  const field = (detailFields[check.type] || []).find(({ key }) => {
    const value = data[key];
    return value !== undefined && value !== null && value !== '' && typeof value !== 'object';
  });
  if (field?.label) return field.label;
  const remarks = data.remarks || check.remarks;
  return typeof remarks === 'string' && remarks.trim() ? remarks : 'Verification completed';
};

const summaryCheckLabel = (type) => ({
  IDENTITY: 'Identity Verification (Aadhar Card)',
  ADDRESS: 'Address Verification (Digital)',
  UAN: 'Employment History Verification (UAN)',
  EDUCATION: 'Education Verification',
  COURT: 'Criminal Record Verification (Court Check - PAN Address)',
  CIBIL: 'CIBIL Verification',
  TWENTY_SIX_AS: '26AS Verification',
  POLICE: 'Police Verification',
  PAN: 'PAN Verification',
  EMPLOYMENT: 'Employment Verification',
  DOCUMENT: 'Document Verification',
  DOCUMENT_FORGERY: 'Document Authenticity Verification',
}[type] || `${type.replaceAll('_', ' ')} Verification`);

const resultRows = (check) => {
  const data = resultData(check);
  const fieldsByType = {
    IDENTITY: [{ key: 'aadhaarNumber', label: 'Aadhar Card Number' }],
    ADDRESS: [
      { key: 'currentAddress', label: 'Current Address' },
      { key: 'permanentAddress', label: 'Permanent Address (PAN Card)' },
    ],
    UAN: [{ key: 'uanNumber', label: 'UAN Number' }, { key: 'uan', label: 'UAN Number' }],
    PAN: [{ key: 'panNumber', label: 'PAN Number' }, { key: 'pan', label: 'PAN Number' }],
    CIBIL: [{ key: 'creditScore', label: 'CIBIL Score' }, { key: 'score', label: 'CIBIL Score' }, { key: 'reportDate', label: 'Report Date' }],
    TWENTY_SIX_AS: [{ key: 'assessmentYear', label: 'Assessment Year' }, { key: 'taxStatus', label: 'Tax Status' }, { key: 'totalIncome', label: 'Total Income' }],
    POLICE: [{ key: 'policeStation', label: 'Police Station' }, { key: 'policeReportNumber', label: 'Police Report Number' }, { key: 'verificationStatus', label: 'Police Verification Status' }, { key: 'remarks', label: 'Police Remarks' }],
    DOCUMENT: [
      { key: 'documentName', label: 'Document Name' }, { key: 'documentType', label: 'Document Type' },
      { key: 'documentNumber', label: 'Document Number' },
    ],
    DOCUMENT_FORGERY: [
      { key: 'documentName', label: 'Document Name' }, { key: 'documentType', label: 'Document Type' },
      { key: 'documentNumber', label: 'Document Number' },
    ],
    EDUCATION: [{ key: 'documentName', label: 'Document Name' }],
    COURT: [
      { key: 'civilProceedings', label: 'Civil Proceedings' },
      { key: 'criminalProceedings', label: 'Criminal Proceedings' },
    ],
  };
  const fields = fieldsByType[check.type] || [];
  const rows = check.type === 'PAN' || check.type === 'UAN'
    ? firstAvailableField(data, fields)
    : rowsForFields(data, fields);
  rows.push(...commonRows(data, check));
  return rows;
};

const drawStructuredEntries = (doc, check, companyName, logo) => {
  const data = resultData(check);
  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (!entries.length) return false;

  entries.forEach((entry, index) => {
    const fields = check.type === 'EMPLOYMENT'
      ? [
        ['companyName', 'Company Name'], ['designation', 'Designation'], ['department', 'Department'],
        ['employeeId', 'Employee ID'], ['periodFrom', 'Period From'], ['periodTo', 'Period To'],
        ['jobDescription', 'Job Description'], ['remuneration', 'Remuneration'],
        ['reportingManager', 'Reporting Manager'], ['reasonForLeaving', 'Reason For Leaving'],
        ['integrityIssues', 'Integrity Issues'], ['exitFormalitiesCompleted', 'Exit Formalities Completed'],
        ['registeredInMCA', 'Registered In MCA'], ['listedOnline', 'Listed Online'],
        ['domainName', 'Domain Name'], ['familyOwnedBusiness', 'Family Owned Business'],
      ].map(([key, label]) => ({ key, label }))
      : [
        ['educationType', 'Document Name'], ['qualification', 'Qualification'], ['institute', 'Institute'],
        ['yearOfPassing', 'Year Of Passing'], ['specialization', 'Specialization'],
        ['boardOrUniversity', 'Board / University'], ['percentage', 'Percentage'],
      ].map(([key, label]) => ({ key, label }));
    const rows = [...rowsForFields(entry, fields), ...commonRows({ ...data, ...entry }, check)];

    ensureSpace(doc, Math.min(330, 40 + rows.length * 27), companyName, logo);
    drawHeaderRow(doc, ['DETAILS', 'FINDINGS'], [245, 254]);
    rows.forEach(([label, value]) => drawRow(doc, label, value, {
      labelWidth: 245,
      ...(label === 'Status' ? { status: value } : {}),
    }));
    doc.y += 12;
  });
  return true;
};

/**
 * Places every image attachment for a check directly below its details
 * table, on the SAME page — this replaces the old addAttachmentPages,
 * which forced a brand-new page per attachment and roughly doubled the
 * page count versus the real report. Two images side by side if there
 * are 2+, one large image if there's only 1.
 */
const drawAttachmentsInline = async (doc, check, companyName, logo) => {
  const documents = check.documents || [];
  const imageAssets = [];
  const nonImageNames = [];

  for (const attachment of documents) {
    const isPdf = attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(String(attachment.fileName || ''));
    if (isPdf) {
      const asset = await readAsset(attachment.fileUrl);
      if (!asset) {
        nonImageNames.push(attachment.fileName);
        continue;
      }
      try {
        imageAssets.push(...await renderPdfPages(asset));
      } catch (_error) {
        nonImageNames.push(attachment.fileName);
      }
      continue;
    }
    if (!String(attachment.mimeType || '').startsWith('image/')) {
      nonImageNames.push(attachment.fileName);
      continue;
    }
    const asset = await readAsset(attachment.fileUrl);
    if (asset) imageAssets.push(asset);
    else nonImageNames.push(attachment.fileName);
  }

  if (nonImageNames.length) {
    ensureSpace(doc, 13 * nonImageNames.length + 6, companyName, logo);
    doc.fillColor(colorsFor(doc).muted).font('Helvetica').fontSize(9);
    nonImageNames.forEach((name) => {
      doc.text(`Attachment: ${name} (available from the case workspace)`, PAGE_LEFT, doc.y);
      doc.y += 13;
    });
  }

  if (!imageAssets.length) return;

  const MIN_USABLE = 180;

  const freshPageIfCramped = () => {
    let remaining = CONTENT_BOTTOM - doc.y - 6;
    if (remaining < MIN_USABLE) {
      drawFooter(doc, companyName);
      doc.addPage();
      drawPageChrome(doc, logo);
      remaining = CONTENT_BOTTOM - doc.y - 6;
    }
    return remaining;
  };

  if (imageAssets.length === 1) {
    const boxHeight = freshPageIfCramped();
    doc.y += 4;
    // fit (not a forced height) preserves aspect ratio, but sizing the
    // bounding box to the actual remaining space — instead of the old
    // fixed 320pt cap — means the image grows to use all the room down
    // to the footer rather than leaving a gap under a small image.
    try {
      doc.image(imageAssets[0], PAGE_LEFT, doc.y, { fit: [PAGE_WIDTH, boxHeight - 4], align: 'center', valign: 'top' });
    } catch (_error) {
      doc.fillColor(colorsFor(doc).muted).font('Helvetica').fontSize(9).text('Attachment preview unavailable; the original file is available from the case workspace.', PAGE_LEFT, doc.y, { width: PAGE_WIDTH });
    }
    doc.y = CONTENT_BOTTOM;
    return;
  }

  // 2+ images: lay out two per row, each row sized to fill whatever
  // space remains before the footer on its page.
  const gap = 12;
  const cellWidth = (PAGE_WIDTH - gap) / 2;
  for (let i = 0; i < imageAssets.length; i += 2) {
    const avail = freshPageIfCramped();
    doc.y += 4;
    const rowY = doc.y;
    try {
      doc.image(imageAssets[i], PAGE_LEFT, rowY, { fit: [cellWidth, avail - 4], align: 'center', valign: 'top' });
    } catch (_error) {
      doc.fillColor(colorsFor(doc).muted).font('Helvetica').fontSize(8).text('Attachment preview unavailable', PAGE_LEFT, rowY, { width: cellWidth, align: 'center' });
    }
    if (imageAssets[i + 1]) {
      try {
        doc.image(imageAssets[i + 1], PAGE_LEFT + cellWidth + gap, rowY, { fit: [cellWidth, avail - 4], align: 'center', valign: 'top' });
      } catch (_error) {
        doc.fillColor(colorsFor(doc).muted).font('Helvetica').fontSize(8).text('Attachment preview unavailable', PAGE_LEFT + cellWidth + gap, rowY, { width: cellWidth, align: 'center' });
      }
    }
    doc.y = CONTENT_BOTTOM;
  }
};

/* ================================================================== */
/*  Report generation                                                   */
/* ================================================================== */

async function buildReport(item) {
  const companyName = item.client?.company?.name || item.client?.name || 'Background Verification Provider';
  const companyCode = item.client?.company?.shortCode || 'BGV';
  const candidate = item.candidate || {};
  const doc = new PDFDocument({ size: 'A4', margin: 48, autoFirstPage: false });
  doc.reportColors = reportColors(item.client?.company?.primaryColor);
  const logo = await readAsset(item.client?.company?.logoUrl);
  const checks = orderedChecks(item.checks || []);
  const verificationStatus = overallVerificationStatus(checks, item.overallResult);

  /* ---------------------------- Page 1: cover + summary ---------------------------- */

  doc.addPage();
  drawPageChrome(doc, logo);

  // Company name band
  doc.fillColor(colorsFor(doc).navy).rect(PAGE_LEFT, doc.y, PAGE_WIDTH, 54).fill();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(companyName.toUpperCase(), PAGE_LEFT + 10, doc.y + 13, {
    width: PAGE_WIDTH - 20,
    align: 'center',
  });
  doc.font('Helvetica').fontSize(10).text('Background Verification Final Report', PAGE_LEFT + 10, doc.y, {
    width: PAGE_WIDTH - 20,
    align: 'center',
  });
  doc.y += 18;

  drawBand(doc, 'CANDIDATE VERIFICATION INFORMATION');
  drawFullRow(doc, 'NAME OF CANDIDATE', `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim());
  drawPairedRow(doc, { label: 'GENDER', value: candidate.gender || '-' }, { label: 'DATE OF BIRTH', value: reportDate(candidate.dateOfBirth) || '-' });
  drawPairedRow(doc, { label: 'DATE INITIATED', value: reportDate(item.initiatedAt) || '-' }, { label: 'DATE OF COMPLETION', value: reportDate(item.completedAt) || '-' });
  drawPairedRow(doc, { label: `${companyCode} REF NO`, value: item.caseNumber }, { label: 'CLIENT REF NO', value: item.clientReference || '-' });
  drawPairedRow(
    doc,
    { label: 'ENTITY / PACKAGE', value: item.packageName || '-' },
    { label: 'VERIFICATION STATUS', value: verificationStatus, status: verificationStatus }
  );
  doc.y += 10;

  // Classification legend
  drawBand(doc, 'CLASSIFICATION OF REPORT STATUS');
  const classification = [
    ['MAJOR DISCREPANCY', COLORS.red],
    ['MINOR DISCREPANCY', COLORS.amber],
    ['UNABLE TO VERIFY', COLORS.gray],
    ['CLEAR', COLORS.green],
  ];
  const legendWidth = PAGE_WIDTH / classification.length;
  const legendY = doc.y;
  classification.forEach(([label, color], index) => {
    doc.fillColor(color).rect(PAGE_LEFT + index * legendWidth, legendY, legendWidth, 30).fill();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(label, PAGE_LEFT + index * legendWidth + 4, legendY + 10, {
      width: legendWidth - 8,
      align: 'center',
    });
  });
  doc.y = legendY + 30 + 10;

  // Executive summary — real 3-column table with header row, not the
  // old fake 2-column pairing.
  drawBand(doc, 'EXECUTIVE SUMMARY');
  const summaryWidths = [195, 205, 99]; // sums to 499; balanced for long names and concise details
  drawHeaderRow(doc, ['TYPE OF CHECK', 'BRIEF DETAILS', 'STATUS'], summaryWidths);
  checks.forEach((check) => {
    const detail = summaryDetail(check);
    const status = checkStatus(check);
    const label = summaryCheckLabel(check.type);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5);
    const labelHeight = doc.heightOfString(String(label), { width: summaryWidths[0] - 12 });
    doc.font('Helvetica').fontSize(8.5);
    const detailHeight = doc.heightOfString(String(detail), { width: summaryWidths[1] - 16 });
    const height = Math.max(25, labelHeight + 8, detailHeight + 8);

    let x = PAGE_LEFT;
    doc.fillColor(colorsFor(doc).labelBg).rect(x, y, summaryWidths[0], height).fill();
    doc.fillColor(colorsFor(doc).valueBg).rect(x + summaryWidths[0], y, summaryWidths[1], height).fill();
    doc.fillColor(statusColor(status)).rect(x + summaryWidths[0] + summaryWidths[1], y, summaryWidths[2], height).fill();
    doc.strokeColor(colorsFor(doc).border).rect(PAGE_LEFT, y, PAGE_WIDTH, height).stroke();

    doc.fillColor(colorsFor(doc).navy).font('Helvetica-Bold').fontSize(8.5).text(label, x + 6, y + 6, { width: summaryWidths[0] - 12 });
    doc.fillColor(colorsFor(doc).body).font('Helvetica').fontSize(8.5).text(String(detail), x + summaryWidths[0] + 8, y + 6, { width: summaryWidths[1] - 16 });
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text(reportStatus(status), x + summaryWidths[0] + summaryWidths[1], y + 6, { width: summaryWidths[2], align: 'center' });

    doc.y = y + height;
  });

  drawFooter(doc, companyName);

  /* ---------------------------- One page per check ---------------------------- */

  for (const check of checks) {
    doc.addPage();
    drawPageChrome(doc, logo);
    drawBand(doc, `${check.type.replaceAll('_', ' ')} VERIFICATION`);

    const renderedStructured =
      check.type === 'EMPLOYMENT' || check.type === 'EDUCATION' ? drawStructuredEntries(doc, check, companyName, logo) : false;

    if (!renderedStructured) {
      const rows = resultRows(check);
      const status = checkStatus(check);
      ensureSpace(doc, 24 + Math.min(400, 30 + rows.length * 27), companyName, logo);
      drawHeaderRow(doc, ['DETAILS', 'FINDINGS'], [245, 254]);
      if (rows.length) {
        rows.forEach(([label, value]) => drawRow(doc, label, value, {
          labelWidth: 245,
          ...(label === 'Status' ? { status: value } : {}),
        }));
      } else {
        drawRow(doc, 'Details', 'No details entered', { labelWidth: 245 });
      }
    }

    // Images go directly under the table on this same page, not on a
    // separate page — this is the main structural fix versus the old
    // addAttachmentPages behavior.
    await drawAttachmentsInline(doc, check, companyName, logo);

    drawFooter(doc, companyName);
  }

  /* ---------------------------- Disclaimer (final page) ---------------------------- */

  doc.addPage();
  drawPageChrome(doc, logo);
  doc.y = 120;
  drawBand(doc, 'DISCLAIMER');
  doc
    .fillColor(colorsFor(doc).muted)
    .font('Helvetica')
    .fontSize(10)
    .text(
      `This report has been prepared solely for the purpose set out pursuant to terms and conditions agreed with ${companyName}. The report and information provided herein are strictly confidential and contain personal and sensitive information. It may be used only for internal, non-commercial assessment of the subject and in accordance with applicable data protection laws.`,
      PAGE_LEFT,
      doc.y,
      { width: PAGE_WIDTH, lineGap: 4 }
    );
  doc.y += 16;
  doc.text(
    'Copyright: All rights reserved. No part of this publication may be reproduced, photocopied, transmitted or used for any other purpose without prior written consent.',
    PAGE_LEFT,
    doc.y,
    { width: PAGE_WIDTH, lineGap: 4 }
  );
  doc.y += 40;
  doc.fillColor(colorsFor(doc).navy).font('Helvetica-Bold').fontSize(14).text('--- End of Report ---', PAGE_LEFT, doc.y, {
    width: PAGE_WIDTH,
    align: 'center',
  });
  drawFooter(doc, companyName);

  return doc;
}

module.exports = { buildReport };