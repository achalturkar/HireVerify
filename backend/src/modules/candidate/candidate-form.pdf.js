'use strict';

const PDFDocument = require('pdfkit');

const COLORS = {
  navy: '#17324D',
  blue: '#245A81',
  muted: '#64748B',
  border: '#D9E2EC',
  pale: '#F3F7FA',
  white: '#FFFFFF',
  text: '#172B3A',
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Not provided' : value.toISOString().slice(0, 10);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const formatLabel = (value) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());

const createCandidateFormPdf = (candidate) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentBottom = doc.page.height - doc.page.margins.bottom - 30;

  const drawPageHeader = () => {
    doc.save();
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9)
      .text('CANDIDATE FORM DETAILS', doc.page.margins.left, 22, { characterSpacing: 0.8 });
    doc.strokeColor(COLORS.border).moveTo(doc.page.margins.left, 38).lineTo(doc.page.width - doc.page.margins.right, 38).stroke();
    doc.restore();
    doc.y = 54;
  };

  doc.on('pageAdded', drawPageHeader);
  doc.addPage();

  const ensureSpace = (height) => {
    if (doc.y + height > contentBottom) doc.addPage();
  };

  const addSection = (title) => {
    ensureSpace(82);
    doc.moveDown(0.5);
    doc.fillColor(COLORS.blue).roundedRect(doc.page.margins.left, doc.y, pageWidth, 25, 4).fill();
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(10)
      .text(title.toUpperCase(), doc.page.margins.left + 10, doc.y + 7, { width: pageWidth - 20 });
    doc.y += 34;
  };

  const addRow = (entries) => {
    const gap = entries.length === 2 ? 8 : 0;
    const cellWidth = (pageWidth - gap) / entries.length;
    const cells = entries.map(([label, value]) => {
      const valueText = formatValue(value);
      doc.font('Helvetica').fontSize(9.5);
      return {
        label,
        valueText,
        valueHeight: doc.heightOfString(valueText, { width: cellWidth - 20, lineGap: 2 }),
      };
    });
    const rowHeight = Math.max(39, ...cells.map((cell) => cell.valueHeight + 24));
    ensureSpace(rowHeight + 2);
    const y = doc.y;
    cells.forEach((cell, index) => {
      const x = doc.page.margins.left + index * (cellWidth + gap);
      doc.fillColor(COLORS.pale).roundedRect(x, y, cellWidth, rowHeight, 3).fill();
      doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.5)
        .text(cell.label.toUpperCase(), x + 10, y + 6, { width: cellWidth - 20 });
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(9.5)
        .text(cell.valueText, x + 10, y + 18, { width: cellWidth - 20, lineGap: 2 });
    });
    doc.y = y + rowHeight + 4;
  };

  const addField = (label, value) => addRow([[label, value]]);
  const needsFullWidth = ([label, value]) => label.length > 26 || String(value ?? '').length > 56;
  const addFields = (entries) => {
    for (let index = 0; index < entries.length;) {
      const current = entries[index];
      const next = entries[index + 1];
      if (!needsFullWidth(current) && next && !needsFullWidth(next)) {
        addRow([current, next]);
        index += 2;
      } else {
        addField(current[0], current[1]);
        index += 1;
      }
    }
  };
  const fullName = candidate.fullName || [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ');

  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(20).text('Candidate form details', { align: 'center' });
  doc.moveDown(0.35);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10)
    .text(`${fullName || 'Candidate'} · ${candidate.candidateCode}`, { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(COLORS.muted).fontSize(8)
    .text(`Prepared ${new Date().toISOString().slice(0, 10)}${candidate.client?.name ? ` · Client: ${candidate.client.name}` : ''}`, { align: 'center' });
  doc.moveDown(0.8);

  addSection('Personal details');
  addFields([
    ['Candidate code', candidate.candidateCode],
    ['Full name', fullName],
    ['Email', candidate.email],
    ['Phone', candidate.phone],
    ['Date of birth', candidate.dateOfBirth],
    ['Gender', candidate.gender],
    ['Candidate status', candidate.status],
  ]);

  addSection('Family details');
  addFields([["Father's name", candidate.fatherName], ["Mother's name", candidate.motherName]]);

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
  addFields([
    ['Highest qualification', candidate.highestQualification],
    ['Course or degree', candidate.courseName],
    ['Institution', candidate.institutionName],
    ['University or board', candidate.universityName],
    ['Year of passing', candidate.yearOfPassing],
    ['Grade or percentage', candidate.gradeOrPercentage],
  ]);

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
    workLocation: candidate.workLocation,
  };
  const employments = [currentEmployment, ...employmentHistory.filter((record) => !record.isCurrent)];
  if (employments.length) {
    employments.forEach((record, index) => {
      addField(`Employer ${index + 1} · ${record.isCurrent ? 'Current' : 'Past'}`, record.employerName);
      addFields([
        ['Employee ID', record.employeeId],
        ['Designation', record.designation],
        ['Department', record.department],
        ['Employment type', record.employmentType],
        ['Start date', record.startDate],
        ['End date', record.isCurrent ? 'Present' : record.endDate],
        ['Work location', record.workLocation],
      ]);
    });
  } else {
    addField('Employment history', 'Not provided');
  }

  addSection('Address details');
  addFields([
    ['Current address', candidate.currentAddress],
    ['Permanent address', candidate.permanentAddress],
  ]);

  addSection('Uploaded documents');
  if (candidate.documents?.length) {
    candidate.documents.forEach((document) => {
      addField(`${formatLabel(document.documentType)} · ${document.fileName}`, `${document.verificationStatus || 'Uploaded'} · ${formatValue(document.uploadedAt)}`);
    });
  } else {
    addField('Documents', 'No documents uploaded');
  }

  addSection('Consent');
  const consent = candidate.consents?.[0];
  addFields([
    ['Consent status', consent?.consentGiven && !consent.revokedAt ? 'Yes' : consent?.revokedAt ? 'Revoked' : 'No'],
    ['Consent date', consent?.consentedAt],
    ['Consent statement version', consent?.consentVersion],
    ['Consent statement', consent?.consentText],
  ]);

  const pageRange = doc.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    doc.switchToPage(index);
    doc.save();
    doc.strokeColor(COLORS.border).moveTo(doc.page.margins.left, doc.page.height - 62)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 62).stroke();
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
      .text(`${candidate.candidateCode} · Confidential`, doc.page.margins.left, doc.page.height - 54, { width: pageWidth / 2 });
    doc.text(`Page ${index + 1} of ${pageRange.count}`, doc.page.width - doc.page.margins.right - pageWidth / 2, doc.page.height - 54, {
      width: pageWidth / 2,
      align: 'right',
    });
    doc.restore();
  }

  return doc;
};

module.exports = { createCandidateFormPdf };
