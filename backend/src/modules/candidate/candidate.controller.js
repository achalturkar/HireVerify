'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const { parsePagination, buildMeta } = require('../../utils/pagination');
const { writeAudit } = require('../../utils/audit');
const { NotFoundError } = require('../../utils/errors');
const XLSX = require('xlsx');
const service = require('./candidate.services');

const createCandidate = asyncHandler(async (req, res) => {
  const data = await service.create({ payload: req.body, companyId: req.user.companyId, currentUser: req.user });
  await writeAudit({ req, action: 'CANDIDATE_CREATED', entity: 'Candidate', entityId: data.id, metadata: { candidateCode: data.candidateCode } });
  return created(res, { message: 'Candidate created successfully.', data });
});

const getCandidate = asyncHandler(async (req, res) => {
  const data = await service.getById({ id: req.params.id, companyId: req.user.companyId });
  return success(res, { message: 'Candidate', data });
});

const downloadCandidateFormPdf = asyncHandler(async (req, res) => {
  const doc = await service.buildFormPdf({ id: req.params.id, companyId: req.user.companyId });
  const safeCode = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="candidate-form-${safeCode}.pdf"`);
  doc.pipe(res);
  doc.end();
});

const listCandidates = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query);
  const { items, total } = await service.list({
    companyId: req.user.companyId,
    query: { ...pagination, search: req.query.search, clientId: req.query.clientId, subclientId: req.query.subclientId, status: req.query.status, dateFrom: req.query.dateFrom, dateTo: req.query.dateTo, includeDeleted: req.query.includeDeleted, sortBy: req.query.sortBy, sortOrder: req.query.sortOrder },
  });
  return success(res, { message: 'Candidates', data: items, meta: buildMeta({ page: pagination.page, limit: pagination.limit, total }) });
});

const exportCandidates = asyncHandler(async (req, res) => {
  const items = await service.listForExport({
    companyId: req.user.companyId,
    query: {
      candidateId: req.params.id,
      search: req.query.search,
      clientId: req.query.clientId,
      subclientId: req.query.subclientId,
      status: req.query.status,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    },
  });
  if (req.params.id && items.length === 0) throw new NotFoundError('Candidate not found');
  const columns = [
    ['Candidate ID', (item) => item.id],
    ['Candidate Code', (item) => item.candidateCode],
    ['Candidate Name', (item) => item.fullName],
    ['Client', (item) => item.client?.name],
    ['Subclient', (item) => item.subclient?.name],
    ['Email', (item) => item.email],
    ['Mobile', (item) => item.phone],
    ['Date of Birth', (item) => item.dateOfBirth],
    ['Gender', (item) => item.gender],
    ['Father Name', (item) => item.fatherName],
    ['Mother Name', (item) => item.motherName],
    ['Aadhaar Number', (item) => item.aadhaarNumber],
    ['PAN Number', (item) => item.panNumber],
    ['UAN Number', (item) => item.uanNumber],
    ['Passport Number', (item) => item.passportNumber],
    ['Driving License Number', (item) => item.drivingLicenseNumber],
    ['Voter ID Number', (item) => item.voterIdNumber],
    ['Highest Qualification', (item) => item.highestQualification],
    ['Course Name', (item) => item.courseName],
    ['Institution Name', (item) => item.institutionName],
    ['University Name', (item) => item.universityName],
    ['Year of Passing', (item) => item.yearOfPassing],
    ['Grade or Percentage', (item) => item.gradeOrPercentage],
    ['Employee ID', (item) => item.employeeId],
    ['Designation', (item) => item.employeeDesignation],
    ['Department', (item) => item.employeeDepartment],
    ['Employment Type', (item) => item.employmentType],
    ['Joining Date', (item) => item.joiningDate],
    ['Work Location', (item) => item.workLocation],
    ['Current Employer', (item) => item.currentEmployer],
    ['Current Address', (item) => item.currentAddress],
    ['Permanent Address', (item) => item.permanentAddress],
    ['Status', (item) => item.status],
    ['BGV Case Count', (item) => item._count?.bgvCases ?? 0],
    ['Consent Given', (item) => item.consents?.[0]?.consentGiven == null ? '' : item.consents[0].consentGiven ? 'Yes' : 'No'],
    ['Consent Date', (item) => item.consents?.[0]?.consentedAt],
    ['Consent Revoked At', (item) => item.consents?.[0]?.revokedAt],
    ['Added On', (item) => item.createdAt],
    ['Last Updated', (item) => item.updatedAt],
  ];
  const rows = items.map((item) => columns.map(([, value]) => {
    const cellValue = value(item);
    if (cellValue instanceof Date) return cellValue.toISOString().slice(0, 10);
    return cellValue ?? '';
  }));
  const worksheet = XLSX.utils.aoa_to_sheet([columns.map(([label]) => label), ...rows]);
  worksheet['!cols'] = columns.map(([label]) => ({ wch: Math.min(Math.max(label.length + 2, 16), 32) }));
  if (worksheet['!ref']) {
    worksheet['!autofilter'] = { ref: worksheet['!ref'] };
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
  const employmentRows = items.flatMap((item) => (Array.isArray(item.employmentHistory) ? item.employmentHistory : []).map((history) => ({
    'Candidate ID': item.id,
    'Candidate Code': item.candidateCode,
    'Candidate Name': item.fullName,
    'Current Employment': history.isCurrent ? 'Yes' : 'No',
    'Employer Name': history.employerName || '',
    'Employee ID': history.employeeId || '',
    Designation: history.designation || '',
    Department: history.department || '',
    'Employment Type': history.employmentType || '',
    'Start Date': history.startDate || '',
    'End Date': history.endDate || '',
    'Work Location': history.workLocation || '',
  })));
  const employmentHeaders = ['Candidate ID', 'Candidate Code', 'Candidate Name', 'Current Employment', 'Employer Name', 'Employee ID', 'Designation', 'Department', 'Employment Type', 'Start Date', 'End Date', 'Work Location'];
  const employmentWorksheet = XLSX.utils.aoa_to_sheet([
    employmentHeaders,
    ...employmentRows.map((row) => employmentHeaders.map((header) => row[header])),
  ]);
  employmentWorksheet['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 30 }, ...Array(9).fill({ wch: 22 })];
  if (employmentWorksheet['!ref']) employmentWorksheet['!autofilter'] = { ref: employmentWorksheet['!ref'] };
  XLSX.utils.book_append_sheet(workbook, employmentWorksheet, 'Employment History');
  const documentRows = items.flatMap((item) => (item.documents || []).map((document) => ({
    'Candidate ID': item.id,
    'Candidate Code': item.candidateCode,
    'Candidate Name': item.fullName,
    'Document Type': document.documentType,
    'Document Number': document.documentNumber || '',
    'File Name': document.fileName,
    'Verification Status': document.verificationStatus,
    'Uploaded On': document.uploadedAt instanceof Date ? document.uploadedAt.toISOString().slice(0, 10) : document.uploadedAt,
  })));
  const documentHeaders = ['Candidate ID', 'Candidate Code', 'Candidate Name', 'Document Type', 'Document Number', 'File Name', 'Verification Status', 'Uploaded On'];
  const documentWorksheet = XLSX.utils.aoa_to_sheet([
    documentHeaders,
    ...documentRows.map((row) => documentHeaders.map((header) => row[header])),
  ]);
  documentWorksheet['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 32 }, { wch: 24 }, { wch: 18 }];
  if (documentWorksheet['!ref']) documentWorksheet['!autofilter'] = { ref: documentWorksheet['!ref'] };
  XLSX.utils.book_append_sheet(workbook, documentWorksheet, 'Documents');
  const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await writeAudit({
    req,
    action: req.params.id ? 'CANDIDATE_EXPORTED' : 'CANDIDATES_EXPORTED',
    entity: 'Candidate',
    entityId: req.params.id || null,
    metadata: { count: items.length },
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const candidateFilePart = String(items[0]?.candidateCode || 'candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id ? `candidate-${candidateFilePart}` : 'candidates-export'}.xlsx"`);
  res.send(file);
});

const updateCandidate = asyncHandler(async (req, res) => {
  const data = await service.update({ id: req.params.id, companyId: req.user.companyId, payload: req.body, currentUser: req.user });
  await writeAudit({ req, action: 'CANDIDATE_UPDATED', entity: 'Candidate', entityId: req.params.id });
  return success(res, { message: 'Candidate updated successfully.', data });
});

const deleteCandidate = asyncHandler(async (req, res) => {
  await service.remove({ id: req.params.id, companyId: req.user.companyId });
  await writeAudit({ req, action: 'CANDIDATE_DELETED', entity: 'Candidate', entityId: req.params.id });
  return success(res, { message: 'Candidate deleted successfully.' });
});

module.exports = { createCandidate, getCandidate, downloadCandidateFormPdf, listCandidates, exportCandidates, updateCandidate, deleteCandidate };
