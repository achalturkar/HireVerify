'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

const COLORS = {
  navy: '#17324D',
  blue: '#245A81',
  muted: '#64748B',
  border: '#D9E2EC',
  pale: '#F3F7FA',
  white: '#FFFFFF',
  text: '#172B3A',
  green: '#16835D',
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Not provided' : value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const formatLabel = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .replace(/^./, (character) => character.toUpperCase());

const readRemoteAsset = (assetUrl) => new Promise((resolve) => {
  const client = assetUrl.startsWith('https://') ? https : http;
  let settled = false;
  const finish = (asset) => {
    if (settled) return;
    settled = true;
    resolve(asset);
  };
  const request = client.get(assetUrl, (response) => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      finish(null);
      return;
    }
    const chunks = [];
    let bytes = 0;
    response.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 3 * 1024 * 1024) {
        request.destroy();
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => finish(Buffer.concat(chunks)));
    response.on('error', () => finish(null));
  });
  request.on('error', () => finish(null));
  request.setTimeout(5000, () => {
    request.destroy();
    finish(null);
  });
});

const loadLogo = async (assetUrl) => {
  if (!assetUrl || typeof assetUrl !== 'string') return null;
  let asset;
  if (/^https?:\/\//i.test(assetUrl)) {
    asset = await readRemoteAsset(assetUrl);
  } else {
    const relativePath = assetUrl.replace(/^[/\\]+/, '');
    const localPath = path.resolve(process.cwd(), relativePath);
    const rootPath = `${path.resolve(process.cwd())}${path.sep}`;
    if (!localPath.startsWith(rootPath)) return null;
    try {
      asset = await fs.promises.readFile(localPath);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES') return null;
      throw error;
    }
  }
  if (!asset) return null;
  try {
    return await sharp(asset)
      .rotate()
      .resize({ width: 480, height: 240, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch (_error) {
    return null;
  }
};

const createCandidateFormPdf = async (candidate) => {
  const [companyLogo, clientLogo] = await Promise.all([
    loadLogo(candidate.company?.logoUrl),
    loadLogo(candidate.client?.logoUrl),
  ]);
  const doc = new PDFDocument({
    size: 'A4',
    margin: 42,
    bufferPages: true,
    autoFirstPage: false,
  });
  const accent = /^#[0-9a-f]{6}$/i.test(candidate.company?.primaryColor || '')
    ? candidate.company.primaryColor
    : COLORS.blue;
  const fullName = candidate.fullName || [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ');

  const drawLogo = (logo, label, x, align) => {
    const width = 54;
    const height = 36;
    if (logo) {
      try {
        doc.image(logo, x, 20, { fit: [width, height], align: 'center', valign: 'center' });
      } catch (_error) {
        // Keep the textual brand label when an uploaded logo cannot be rendered.
      }
    }
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(6.5)
      .text(label || '', x, 58, { width, align, lineBreak: false, ellipsis: true });
  };

  const drawPageHeader = () => {
    drawLogo(companyLogo, candidate.company?.name || 'Verification provider', 42, 'left');
    drawLogo(clientLogo, candidate.client?.name || 'Client', doc.page.width - 96, 'right');
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11)
      .text('CANDIDATE INFORMATION', 112, 25, { width: doc.page.width - 224, align: 'center' });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(candidate.candidateCode || 'Candidate record', 112, 43, { width: doc.page.width - 224, align: 'center' });
    doc.strokeColor(COLORS.border).lineWidth(1)
      .moveTo(doc.page.margins.left, 75)
      .lineTo(doc.page.width - doc.page.margins.right, 75)
      .stroke();
    doc.y = 88;
  };

  doc.on('pageAdded', drawPageHeader);
  doc.addPage();
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentBottom = doc.page.height - doc.page.margins.bottom - 20;

  const ensureSpace = (height) => {
    if (doc.y + height > contentBottom) doc.addPage();
  };

  const addSection = (title) => {
    ensureSpace(42);
    const y = doc.y;
    doc.fillColor(accent).roundedRect(doc.page.margins.left, y, pageWidth, 24, 4).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9.5)
      .text(title.toUpperCase(), doc.page.margins.left + 10, y + 7, { width: pageWidth - 20, lineBreak: false });
    doc.y = y + 31;
  };

  const addSubheading = (title) => {
    ensureSpace(30);
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9)
      .text(title, doc.page.margins.left, doc.y, { width: pageWidth });
    doc.y += 15;
  };

  const addRow = (entries) => {
    const gap = entries.length === 2 ? 8 : 0;
    const cellWidth = (pageWidth - gap) / entries.length;
    const cells = entries.map(([label, value]) => {
      const valueText = formatValue(value);
      doc.font('Helvetica').fontSize(9);
      return {
        label,
        valueText,
        valueHeight: doc.heightOfString(valueText, { width: cellWidth - 20, lineGap: 2 }),
      };
    });
    const rowHeight = Math.max(39, ...cells.map((cell) => cell.valueHeight + 25));
    ensureSpace(rowHeight + 4);
    const y = doc.y;
    cells.forEach((cell, index) => {
      const x = doc.page.margins.left + index * (cellWidth + gap);
      doc.fillColor(COLORS.pale).roundedRect(x, y, cellWidth, rowHeight, 4).fill();
      doc.strokeColor(COLORS.border).lineWidth(0.5).roundedRect(x, y, cellWidth, rowHeight, 4).stroke();
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7)
        .text(String(cell.label).toUpperCase(), x + 10, y + 6, { width: cellWidth - 20 });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
        .text(cell.valueText, x + 10, y + 18, { width: cellWidth - 20, lineGap: 2 });
    });
    doc.y = y + rowHeight + 4;
  };

  const needsFullWidth = ([label, value]) => String(label).length > 25 || String(value ?? '').length > 52;
  const addFields = (entries) => {
    for (let index = 0; index < entries.length;) {
      const current = entries[index];
      const next = entries[index + 1];
      if (!needsFullWidth(current) && next && !needsFullWidth(next)) {
        addRow([current, next]);
        index += 2;
      } else {
        addRow([current]);
        index += 1;
      }
    }
  };

  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(19)
    .text('Background verification details', { align: 'center' });
  doc.moveDown(0.25);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
    .text(`${fullName || 'Candidate'}  ·  ${candidate.client?.name || 'Client'}`, { align: 'center' });
  doc.moveDown(0.25);
  doc.fillColor(COLORS.muted).fontSize(7.5)
    .text(`Prepared ${new Date().toISOString().slice(0, 10)}  ·  Confidential candidate record`, { align: 'center' });
  doc.moveDown(0.65);

  addSection('Candidate overview');
  addFields([
    ['Candidate code', candidate.candidateCode],
    ['Candidate status', formatLabel(candidate.status)],
    ['Client', candidate.client?.name],
    ['Subclient', candidate.subclient?.name],
    ['Record created', candidate.createdAt],
    ['Last updated', candidate.updatedAt],
  ]);

  addSection('Personal details');
  addFields([
    ['Full name', fullName],
    ['Email address', candidate.email],
    ['Mobile number', candidate.phone],
    ['Date of birth', candidate.dateOfBirth],
    ['Gender', candidate.gender],
  ]);

  addSection('Family details');
  addFields([
    ["Father's name", candidate.fatherName],
    ["Mother's name", candidate.motherName],
    ['Marital status', formatLabel(candidate.maritalStatus)],
    ['Husband / spouse name', candidate.spouseName],
    ['Number of children', candidate.childrenCount],
  ]);

  addSection('Identity details');
  addFields([
    ['Aadhaar number', candidate.aadhaarNumber],
    ['PAN number', candidate.panNumber],
    ['UAN', candidate.uanNumber],
    ['Passport number', candidate.passportNumber],
    ['Driving licence number', candidate.drivingLicenseNumber],
    ['Voter ID number', candidate.voterIdNumber],
  ]);

  addSection('Education details');
  const legacyEducation = {
    qualification: candidate.highestQualification,
    courseName: candidate.courseName,
    institutionName: candidate.institutionName,
    universityName: candidate.universityName,
    yearOfPassing: candidate.yearOfPassing,
    gradeOrPercentage: candidate.gradeOrPercentage,
  };
  const educationHistory = Array.isArray(candidate.educationHistory) && candidate.educationHistory.length
    ? candidate.educationHistory
    : [legacyEducation];
  educationHistory.forEach((record, index) => {
    addSubheading(`Education record ${index + 1}`);
    addFields([
      ['Qualification', record.qualification],
      ['Course or degree', record.courseName],
      ['Institution', record.institutionName],
      ['University or board', record.universityName],
      ['Year of passing', record.yearOfPassing],
      ['Grade or percentage', record.gradeOrPercentage],
    ]);
  });

  addSection('Employment details');
  const employmentHistory = Array.isArray(candidate.employmentHistory) ? candidate.employmentHistory : [];
  const currentEmployment = {
    isCurrent: true,
    employerName: candidate.currentEmployer,
    employeeId: candidate.employeeId,
    designation: candidate.employeeDesignation,
    department: candidate.employeeDepartment,
    employmentType: candidate.employmentType,
    startDate: candidate.joiningDate,
    endDate: null,
    workLocation: candidate.workLocation,
    employerHrName: candidate.employerHrName,
    employerHrPhone: candidate.employerHrPhone,
  };
  [currentEmployment, ...employmentHistory.filter((record) => record && record.isCurrent !== true)].forEach((record, index) => {
    addSubheading(`Employer ${index + 1}  ·  ${record.isCurrent ? 'Current' : 'Past'}`);
    addFields([
      ['Employer name', record.employerName],
      ['Employee ID', record.employeeId],
      ['Designation', record.designation],
      ['Department', record.department],
      ['Employment type', formatLabel(record.employmentType)],
      ['Start date', record.startDate],
      ['End date', record.isCurrent ? 'Present' : record.endDate],
      ['Work location', record.workLocation],
      ['Employer HR contact name', record.employerHrName],
      ['Employer HR contact number', record.employerHrPhone],
    ]);
  });

  addSection('Address details');
  addFields([
    ['Current address', candidate.currentAddress],
    ['Permanent address', candidate.permanentAddress],
    ['Selected for address verification', Array.isArray(candidate.addressVerificationLocations)
      ? candidate.addressVerificationLocations.map((location) => location === 'current' ? 'Current address' : 'Permanent address').join(', ')
      : ''],
  ]);

  addSection('Candidate notes');
  addRow([['Notes for the verification team', candidate.candidateNotes]]);

  addSection('Consent details');
  const consent = candidate.consents?.[0];
  addFields([
    ['Consent status', consent?.consentGiven && !consent.revokedAt ? 'Given' : consent?.revokedAt ? 'Revoked' : 'Not given'],
    ['Consent date', consent?.consentedAt],
    ['Consent statement version', consent?.consentVersion],
    ['Consent statement', consent?.consentText],
  ]);

  doc.addPage();
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(18)
    .text('Uploaded document register', { align: 'center' });
  doc.moveDown(0.25);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9)
    .text(`${fullName || 'Candidate'}  ·  ${candidate.candidateCode || ''}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.muted).fontSize(8)
    .text('This register lists every document file uploaded to the candidate record.', { align: 'center' });
  doc.moveDown(0.8);

  const documents = [...(candidate.documents || [])]
    .sort((first, second) => new Date(first.uploadedAt || 0) - new Date(second.uploadedAt || 0));
  const columns = [
    { title: 'DOCUMENT TYPE', width: 105 },
    { title: 'UPLOADED FILE NAME', width: 196 },
    { title: 'DOCUMENT NUMBER', width: 105 },
    { title: 'STATUS / UPLOADED', width: 105 },
  ];
  const drawDocumentHeader = () => {
    ensureSpace(28);
    const y = doc.y;
    let x = doc.page.margins.left;
    columns.forEach((column) => {
      doc.fillColor(accent).rect(x, y, column.width, 25).fill();
      doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.5)
        .text(column.title, x + 5, y + 8, { width: column.width - 10, lineBreak: false });
      x += column.width;
    });
    doc.y = y + 25;
  };
  const drawDocumentRow = (document, index) => {
    const values = [
      formatLabel(document.documentType),
      document.fileName || 'File name not available',
      document.documentNumber,
      [formatLabel(document.verificationStatus || 'Uploaded'), formatValue(document.uploadedAt)].join('\n'),
    ];
    doc.font('Helvetica').fontSize(8);
    const heights = values.map((value, columnIndex) => doc.heightOfString(formatValue(value), {
      width: columns[columnIndex].width - 12,
      lineGap: 1,
    }));
    const rowHeight = Math.max(34, ...heights.map((height) => height + 12));
    if (doc.y + rowHeight > contentBottom) {
      doc.addPage();
      drawDocumentHeader();
    }
    let x = doc.page.margins.left;
    const y = doc.y;
    values.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      doc.fillColor(index % 2 === 0 ? COLORS.pale : COLORS.white)
        .rect(x, y, column.width, rowHeight).fill();
      doc.strokeColor(COLORS.border).lineWidth(0.5).rect(x, y, column.width, rowHeight).stroke();
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8)
        .text(formatValue(value), x + 6, y + 6, { width: column.width - 12, lineGap: 1 });
      x += column.width;
    });
    doc.y = y + rowHeight;
  };

  drawDocumentHeader();
  if (documents.length) {
    documents.forEach(drawDocumentRow);
  } else {
    addRow([['Uploaded documents', 'No documents have been uploaded to this candidate record.']]);
  }
  doc.moveDown(0.8);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
    .text(`Total uploaded documents: ${documents.length}`, { align: 'right' });

  const pageRange = doc.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    doc.switchToPage(index);
    doc.save();
    doc.strokeColor(COLORS.border).lineWidth(0.7)
      .moveTo(doc.page.margins.left, doc.page.height - 62)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 62)
      .stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(`${candidate.candidateCode || 'Candidate'}  ·  Confidential`, doc.page.margins.left, doc.page.height - 54, {
        width: pageWidth / 2,
      });
    doc.text(`Page ${index + 1} of ${pageRange.count}`, doc.page.width - doc.page.margins.right - pageWidth / 2, doc.page.height - 54, {
      width: pageWidth / 2,
      align: 'right',
    });
    doc.restore();
  }

  return doc;
};

module.exports = { createCandidateFormPdf };
