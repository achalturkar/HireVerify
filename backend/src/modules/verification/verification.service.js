'use strict';

const repo = require('./verification.repository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const PDFDocument = require('pdfkit');
const surepass = require('./providers/surepass.provider');

const providerImages = (value) => {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).filter((item) => typeof item === 'string' && /^(https?:|data:image\/)/i.test(item));
};

const fetchImage = async (url) => {
  if (/^data:image\//i.test(url)) {
    const encoded = url.split(',')[1];
    return encoded ? Buffer.from(encoded, 'base64') : null;
  }
  try {
    const response = await fetch(url);
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
};

const toDto = (check) => ({
  id: check.id, caseId: check.caseId, type: check.type, provider: check.provider,
  status: check.status, result: check.result, priority: check.priority,
  providerRequestId: check.providerRequestId, providerReferenceId: check.providerReferenceId,
  inputData: check.inputData, resultData: check.resultData, rawResponse: check.rawResponse, failureReason: check.failureReason,
  remarks: check.remarks, startedAt: check.startedAt, completedAt: check.completedAt,
  retryCount: check.retryCount, createdAt: check.createdAt, updatedAt: check.updatedAt,
  isLocked: check.isLocked, lockedAt: check.lockedAt, documents: check.documents || [],
  checkType: check.checkType || undefined,
  case: check.case,
});

const assertCaseEditable = (check) => {
  if (['COMPLETED', 'CANCELLED'].includes(check.case.status)) {
    throw new ConflictError('This case is finalized and its verification details cannot be changed.');
  }
};

const get = async ({ id, companyId }) => {
  const check = await repo.findById(id, companyId);
  if (!check) throw new NotFoundError('Verification check not found');
  return toDto(check);
};

const list = async ({ companyId, caseId, type, status }) => ({ items: (await repo.list(companyId, { caseId, type, status })).map(toDto) });

const create = async ({ payload, companyId }) => {
  const caseItem = await repo.findCase(payload.caseId, companyId);
  if (!caseItem) throw new NotFoundError('BGV case not found');
  if (['COMPLETED', 'CANCELLED'].includes(caseItem.status)) throw new ConflictError('This case is finalized and cannot be changed.');
  const checkType = await repo.findCheckType(payload.type);
  if (!checkType?.isActive) throw new BadRequestError('This verification check is unavailable.');
  const check = await repo.create({ caseId: payload.caseId, type: payload.type, provider: payload.provider || checkType.defaultProvider, priority: payload.priority || 0, inputData: payload.inputData || null });
  await repo.event({ caseId: check.caseId, verificationId: check.id, eventType: 'CREATED', message: 'Verification check created' });
  return toDto(check);
};

const update = async ({ id, companyId, payload }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  const data = { status: payload.status || current.status, ...(payload.result !== undefined ? { result: payload.result } : {}), ...(payload.resultData !== undefined ? { resultData: payload.resultData } : {}), ...(payload.failureReason !== undefined ? { failureReason: payload.failureReason } : {}), ...(payload.remarks !== undefined ? { remarks: payload.remarks } : {}) };
  if (data.status === 'IN_PROGRESS' && !current.startedAt) data.startedAt = new Date();
  if (data.status === 'COMPLETED' || data.status === 'FAILED') data.completedAt = new Date();
  else if (current.status === 'COMPLETED' || current.status === 'FAILED' || current.status === 'CANCELLED') data.completedAt = null;
  const updated = await repo.update(id, data);
  await repo.event({ caseId: updated.caseId, verificationId: id, eventType: data.status === 'COMPLETED' ? 'COMPLETED' : data.status === 'FAILED' ? 'FAILED' : 'STATUS_CHANGED', status: updated.status, message: `Verification status changed to ${updated.status}` });
  return toDto(await repo.findById(id, companyId));
};

const lock = async ({ id, companyId, locked, userId }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  await repo.update(id, { isLocked: locked, lockedAt: locked ? new Date() : null, lockedById: locked ? userId : null });
  return toDto(await repo.findById(id, companyId));
};

const addDocument = async ({ id, companyId, documentType, fileName, fileUrl, mimeType, fileSize }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  await repo.addDocument({ candidateId: current.case.candidateId, verificationId: id, documentType, fileName, fileUrl, mimeType, fileSize });
  return toDto(await repo.findById(id, companyId));
};

const removeDocument = async ({ id, companyId, documentId }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  if (current.isLocked) throw new BadRequestError('This verification is locked');
  await repo.deleteDocument(documentId, id);
  return toDto(await repo.findById(id, companyId));
};

const retry = async ({ id, companyId }) => update({ id, companyId, payload: { status: 'RETRYING' } });

const executePan = async ({ id, companyId, pan: submittedPan }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  if (current.type !== 'PAN') throw new BadRequestError('This verification check is not a PAN check');

  const pan = String(submittedPan || '').trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new BadRequestError('A valid PAN number is required');

  await repo.update(id, { status: 'IN_PROGRESS', startedAt: new Date(), inputData: { ...current.inputData, pan: 'REDACTED' } });
  await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'API_REQUEST', message: 'PAN verification request sent' });
  try {
    const result = await surepass.verifyPan({ pan });
    const updated = await repo.update(id, { status: 'COMPLETED', result: result.result, resultData: result.resultData, providerRequestId: result.providerRequestId, providerReferenceId: result.providerReferenceId, rawResponse: result.rawResponse, completedAt: new Date(), failureReason: null });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'COMPLETED', status: 'COMPLETED', message: 'PAN verification completed' });
    return toDto(updated);
  } catch (error) {
    await repo.update(id, { status: 'FAILED', result: 'UNABLE_TO_VERIFY', failureReason: error.message, completedAt: new Date() });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'FAILED', status: 'FAILED', message: 'PAN verification failed' });
    throw error;
  }
};

const executeCheck = async ({ id, companyId, inputData, apiVersion }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('Verification check not found');
  assertCaseEditable(current);
  if (!['UAN', 'ADDRESS', 'ADDRESS_PHYSICAL', 'COURT', 'POLICE_RECORD'].includes(current.type)) throw new BadRequestError('This check is not configured for Surepass execution');
  await repo.update(id, { status: 'IN_PROGRESS', startedAt: new Date(), inputData });
  await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'API_REQUEST', message: `${current.type} verification request sent` });
  try {
    const result = await surepass.verifyCheck({ type: current.type, inputData, apiVersion });
    const updated = await repo.update(id, { status: 'COMPLETED', result: result.result, resultData: result.resultData, providerRequestId: result.providerRequestId, providerReferenceId: result.providerReferenceId, rawResponse: result.rawResponse, completedAt: new Date(), failureReason: null });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'COMPLETED', status: 'COMPLETED', message: `${current.type} verification completed` });
    return toDto(updated);
  } catch (error) {
    await repo.update(id, { status: 'FAILED', result: 'UNABLE_TO_VERIFY', failureReason: error.message, completedAt: new Date() });
    await repo.event({ caseId: current.caseId, verificationId: id, eventType: 'FAILED', status: 'FAILED', message: `${current.type} verification failed` });
    throw error;
  }
};

const buildPdf = async ({ id, companyId }) => {
  const check = await repo.findById(id, companyId);
  if (!check) throw new NotFoundError('Verification check not found');
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.fillColor('#0B3B66').fontSize(22).font('Helvetica-Bold').text('HireVerify', { continued: true }).fillColor('#0E7C6B').text(' Verification Report');
  doc.moveDown(0.5).fillColor('#667085').fontSize(10).font('Helvetica').text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown().strokeColor('#D0D5DD').moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown().fillColor('#101828').fontSize(15).font('Helvetica-Bold').text(`${check.type} Verification`);
  doc.moveDown(0.6).fontSize(10).font('Helvetica');
  const rows = [['Check ID', check.id], ['Case', check.case?.caseNumber || check.caseId], ['Provider', check.provider], ['Status', check.status], ['Result', check.result], ['Started', check.startedAt ? new Date(check.startedAt).toLocaleString() : 'Not started'], ['Completed', check.completedAt ? new Date(check.completedAt).toLocaleString() : 'Not completed']];
  rows.forEach(([label, value]) => { doc.fillColor('#667085').text(`${label}:`, { continued: true, width: 100 }); doc.fillColor('#101828').text(` ${value}`); doc.moveDown(0.25); });
  doc.moveDown().fillColor('#101828').fontSize(13).font('Helvetica-Bold').text('Normalized findings');
  doc.moveDown(0.4).fontSize(10).font('Helvetica');
  const findings = check.resultData || {};
  Object.entries(findings).filter(([, value]) => !providerImages(findings).includes(value)).forEach(([key, value]) => doc.fillColor('#344054').text(`${key}: ${value === null || value === undefined ? 'Not available' : typeof value === 'object' ? JSON.stringify(value) : String(value)}`));
  const images = providerImages(findings);
  if (images.length) {
    doc.moveDown().fillColor('#101828').fontSize(13).font('Helvetica-Bold').text('Provider images');
    for (const imageUrl of images) {
      const image = await fetchImage(imageUrl);
      if (image) doc.moveDown(0.5).image(image, { fit: [499, 260], align: 'center' });
    }
  }
  doc.moveDown(2).fillColor('#667085').fontSize(9).text('Confidential verification document. This report contains normalized findings for authorized users only.');
  return doc;
};

const executeStandalone = async ({ type, inputData, apiVersion }) => {
  if (type === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(inputData.pan || '').toUpperCase())) throw new BadRequestError('A valid PAN number is required');
  if (type === 'UAN' && !/^\d{12}$/.test(String(inputData.uan || ''))) throw new BadRequestError('A valid 12 digit UAN number is required');
  return surepass.verifyStandalone({ type, inputData: { ...inputData, ...(inputData.pan ? { pan: String(inputData.pan).toUpperCase() } : {}) }, apiVersion });
};

const buildStandalonePdf = async ({ type, inputData, apiVersion }) => {
  const initiatedAt = inputData?.initiatedAt ? new Date(inputData.initiatedAt) : new Date();
  const response = await executeStandalone({ type, inputData, apiVersion });
  const completedAt = new Date();
  const doc = new PDFDocument({ size: 'A4', margin: 0, layout: 'portrait' });
  const data = response?.resultData || {};
  const rawPanDetails = data.rawPanDetails || {};
  const address = data.address || rawPanDetails.address || {};
  const addressText = typeof address === 'string'
    ? address
    : String(address.full || [address.line1, address.line2, address.streetName || address.street_name, address.city, address.state, address.zip || address.postalCode, address.country].filter(Boolean).join(' ') || 'Not available');

  const toDisplay = (value) => value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value);
  const formatDateTime = (date) => Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(/\//g, '-').replace(',', '').toLowerCase();
  const flattenNameSplit = () => {
    const split = rawPanDetails.full_name_split || data.fullNameSplit || [];
    return Array.isArray(split) ? split.join(' | ') : '—';
  };

  const pageTitle = type === 'PAN' ? 'PAN Verification' : `${type} Verification`;
  const rows = [
    ['PAN Number', toDisplay(data.panNumber || rawPanDetails.pan_number || inputData?.pan || 'Not available')],
    ['Name', toDisplay(data.fullName || rawPanDetails.full_name || 'Not available')],
    ['Father Name', toDisplay(rawPanDetails.father_name || rawPanDetails.fatherName || '—')],
    ['Verification Date', toDisplay(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'))],
    ['Verification Source', 'https://www.incometax.gov.in'],
    ['Name Split', flattenNameSplit()],
    ['Masked Aadhaar', toDisplay(rawPanDetails.masked_aadhaar || data.maskedAadhaar || '—')],
    ['Aadhaar Linked', toDisplay(rawPanDetails.aadhaar_linked ?? data.aadhaarLinked ?? '—')],
    ['Email', toDisplay(rawPanDetails.email || data.email || '—')],
    ['Phone Number', toDisplay(rawPanDetails.phone_number || data.phoneNumber || '—')],
    ['Gender', toDisplay(rawPanDetails.gender || data.gender || '—')],
    ['Date of Birth', toDisplay(rawPanDetails.dob || data.dob || '—')],
    ['Input DOB', toDisplay(rawPanDetails.input_dob || data.inputDob || '—')],
    ['DOB Verified', toDisplay(rawPanDetails.dob_verified ?? data.dobVerified ?? '—')],
    ['DOB Check', toDisplay(rawPanDetails.dob_check ?? data.dobCheck ?? '—')],
    ['Category', toDisplay(rawPanDetails.category || data.category || '—')],
    ['Less Info', toDisplay(rawPanDetails.less_info ?? data.lessInfo ?? '—')],
    ['Address', addressText],
    ['Client ID', toDisplay(data.clientId || rawPanDetails.client_id || '—')],
  ];

  const tableX = 15;
  const tableW = doc.page.width - 36;
  const labelW = tableW * 0.4;
  const valueW = tableW - labelW;
  const borderColor = '#C5CEDB';
  const labelFill = '#E8EDF5';
  const navy = '#1F417A';
  const textInset = 7;
  const drawCell = (x, y, width, height, text, { fill, bold = false, centered = false, italic = false } = {}) => {
    doc.fillColor(fill).rect(x, y, width, height).fill();
    doc.strokeColor(borderColor).lineWidth(0.55).rect(x, y, width, height).stroke();
    doc.fillColor(navy).font(italic ? 'Helvetica-Oblique' : bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .text(toDisplay(text), x + textInset, y + Math.max(6, (height - 10) / 2), {
        width: width - textInset * 2,
        height: height - 4,
        align: centered ? 'center' : 'left',
        ellipsis: true,
      });
  };

  doc.fillColor('#FFFFFF').rect(0, 0, doc.page.width, doc.page.height).fill();
  doc.fillColor('#EEF2F8').rect(tableX, 7, tableW, 41).fill();
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(16).text(pageTitle, tableX, 20, { align: 'center', width: tableW });

  doc.fillColor(navy).rect(tableX, 56, tableW, 32).fill();
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(pageTitle, tableX, 66, { align: 'center', width: tableW });

  let y = 99;
  const dateColumnW = tableW / 2;
  const dateLabels = [['Initiated Date', formatDateTime(initiatedAt)], ['Completed Date', formatDateTime(completedAt)]];
  dateLabels.forEach(([label], index) => drawCell(tableX + dateColumnW * index, y, dateColumnW, 24, label, { fill: labelFill, bold: true }));
  y += 24;
  dateLabels.forEach(([, value], index) => drawCell(tableX + dateColumnW * index, y, dateColumnW, 26, value, { fill: '#FFFFFF' }));
  y += 26;

  rows.forEach(([label, value]) => {
    const displayValue = toDisplay(value);
    doc.font('Helvetica').fontSize(9);
    const textHeight = doc.heightOfString(displayValue, { width: valueW - textInset * 2 });
    const rowHeight = Math.max(25, Math.ceil(textHeight + 12));
    drawCell(tableX, y, labelW, rowHeight, label, { fill: labelFill, bold: true });
    drawCell(tableX + labelW, y, valueW, rowHeight, displayValue, { fill: '#FFFFFF' });
    y += rowHeight;
  });

  const disclaimerY = y + 13;
  const disclaimer = 'Disclaimer: The content of this report has been sourced from the government of India websites & this report has been updated on the date of verification. The data might have been changed, deleted or modified from thereon.';
  doc.fillColor('#667085').font('Helvetica-Oblique').fontSize(8).text(disclaimer, tableX, disclaimerY, { width: tableW, align: 'left' });

  const footerY = doc.page.height - 35;
  doc.strokeColor(navy).lineWidth(0.7).moveTo(tableX, footerY).lineTo(tableX + tableW, footerY).stroke();
  doc.fillColor('#667085').font('Helvetica').fontSize(7).text('Confidential . © Brainhunt Ventures Pvt Ltd', tableX, footerY + 7, { width: tableW / 2 });
  doc.text('Page 1 / 1', tableX + tableW / 2, footerY + 7, { width: tableW / 2, align: 'right' });

  return doc;
};

module.exports = { get, list, create, update, retry, executePan, executeCheck, executeStandalone, buildStandalonePdf, lock, addDocument, removeDocument, buildPdf };
