'use strict';

const { prisma } = require('../../common/prisma');
const repo = require('./candidate.repository');

const { NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors');
const { parseDateValue } = require('../../utils/date');
const { IDENTITY_FIELDS, normalizeConfig, normalizeIdentityValue, validateIdentityValues } = require('../client/candidate-intake-config');
const { normalizeCandidateName, hasCandidateName } = require('../../utils/candidate-name');
const { createCandidateFormPdf } = require('./candidate-form.pdf');

const toDto = (candidate) => ({
  id: candidate.id,
  companyId: candidate.companyId,
  clientId: candidate.clientId,
  client: candidate.client ? {
    id: candidate.client.id,
    name: candidate.client.name,
    clientCode: candidate.client.clientCode,
    contactEmail: candidate.client.contactEmail,
    contactPhone: candidate.client.contactPhone,
    logoUrl: candidate.client.logoUrl,
  } : null,
  company: candidate.company ? {
    name: candidate.company.name,
    logoUrl: candidate.company.logoUrl,
    primaryColor: candidate.company.primaryColor,
  } : null,
  subclientId: candidate.subclientId || null,
  subclient: candidate.subclient || null,
  candidateCode: candidate.candidateCode,
  portalLinkExpiryDays: normalizeConfig(candidate.client?.candidateFormConfig).invitationExpiryDays,
  fullName: candidate.fullName,
  firstName: candidate.firstName,
  middleName: candidate.middleName,
  lastName: candidate.lastName,
  email: candidate.email,
  phone: candidate.phone,
  dateOfBirth: candidate.dateOfBirth,
  gender: candidate.gender,
  fatherName: candidate.fatherName,
  motherName: candidate.motherName,
  maritalStatus: candidate.maritalStatus,
  spouseName: candidate.spouseName,
  childrenCount: candidate.childrenCount,
  candidateNotes: candidate.candidateNotes,
  aadhaarNumber: candidate.aadhaarNumber,
  panNumber: candidate.panNumber,
  uanNumber: candidate.uanNumber,
  passportNumber: candidate.passportNumber,
  drivingLicenseNumber: candidate.drivingLicenseNumber,
  voterIdNumber: candidate.voterIdNumber,
  highestQualification: candidate.highestQualification,
  courseName: candidate.courseName,
  institutionName: candidate.institutionName,
  universityName: candidate.universityName,
  yearOfPassing: candidate.yearOfPassing,
  gradeOrPercentage: candidate.gradeOrPercentage,
  educationHistory: candidate.educationHistory || [],
  employeeId: candidate.employeeId,
  employeeDesignation: candidate.employeeDesignation,
  employeeDepartment: candidate.employeeDepartment,
  employmentType: candidate.employmentType,
  joiningDate: candidate.joiningDate,
  workLocation: candidate.workLocation,
  currentEmployer: candidate.currentEmployer,
  employerHrName: candidate.employerHrName,
  employerHrPhone: candidate.employerHrPhone,
  employmentHistory: candidate.employmentHistory || [],
  currentAddress: candidate.currentAddress,
  permanentAddress: candidate.permanentAddress,
  addressVerificationLocations: candidate.addressVerificationLocations || [],
  status: candidate.status,
  createdById: candidate.createdById,
  updatedById: candidate.updatedById,
  createdAt: candidate.createdAt,
  updatedAt: candidate.updatedAt,
  bgvCaseCount: candidate._count?.bgvCases,
  documents: candidate.documents?.map((document) => ({ id: document.id, documentType: document.documentType, documentNumber: document.documentNumber, fileName: document.fileName, fileUrl: document.fileUrl, verificationStatus: document.verificationStatus, uploadedAt: document.uploadedAt })) || [],
  consents: candidate.consents || [],
  portalInvitation: candidate.portalInvitation || null,
});

const createCandidateCode = async (clientId, companyId) => {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, isDeleted: false },
    select: { clientCode: true },
  });
  if (!client) throw new NotFoundError('Client not found');

  const year = new Date().getFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.candidate.count({
    where: { companyId, clientId, createdAt: { gte: startOfYear, lt: startOfNextYear } },
  });

  return `${client.clientCode}-${year}-${String(count + 1).padStart(4, '0')}`;
};

const normalizeDateOfBirth = (value) => parseDateValue(value, 'Date of birth');

const assertClientBelongsToCompany = async (clientId, companyId) => {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, parentClientId: null, isDeleted: false },
    select: { id: true, candidateFormConfig: true },
  });

  return client;
};

const assertSubclientBelongsToClient = async (subclientId, clientId, companyId) => {
  if (!subclientId) return null;
  const subclient = await prisma.client.findFirst({
    where: { id: subclientId, parentClientId: clientId, companyId, isDeleted: false, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!subclient) throw new BadRequestError('Select an active subclient under the selected client.');
  return subclient;
};

const create = async ({ payload, companyId, currentUser }) => {
  const { clientId, subclientId, email, phone } = payload;

  if (!clientId) throw new BadRequestError('Client is required');
  const candidateName = normalizeCandidateName(payload);
  const normalizedEmail = email?.trim().toLowerCase() || null;

  const client = await assertClientBelongsToCompany(clientId, companyId);
  await assertSubclientBelongsToClient(subclientId, clientId, companyId);
  validateIdentityValues(payload);
  const intakeConfig = normalizeConfig(client.candidateFormConfig);
  for (const { key, label } of IDENTITY_FIELDS) {
    const value = payload[key];
    if (value && !intakeConfig[key].enabled) {
      throw new BadRequestError(`${label} is not enabled for this client’s candidate form.`);
    }
  }

  const candidate = await repo.create({
    companyId,
    clientId,
    subclientId: subclientId || null,
    candidateCode: await createCandidateCode(clientId, companyId),
    ...candidateName,
    email: normalizedEmail,
    phone: phone || null,
    dateOfBirth: normalizeDateOfBirth(payload.dateOfBirth) ?? null,
    gender: payload.gender || null,
    fatherName: payload.fatherName || null,
    motherName: payload.motherName || null,
    aadhaarNumber: normalizeIdentityValue('aadhaarNumber', payload.aadhaarNumber) || null,
    panNumber: normalizeIdentityValue('panNumber', payload.panNumber) || null,
    uanNumber: normalizeIdentityValue('uanNumber', payload.uanNumber) || null,
    passportNumber: normalizeIdentityValue('passportNumber', payload.passportNumber) || null,
    drivingLicenseNumber: normalizeIdentityValue('drivingLicenseNumber', payload.drivingLicenseNumber) || null,
    voterIdNumber: normalizeIdentityValue('voterIdNumber', payload.voterIdNumber) || null,
    highestQualification: payload.highestQualification || null,
    courseName: payload.courseName || null,
    institutionName: payload.institutionName || null,
    universityName: payload.universityName || null,
    yearOfPassing: payload.yearOfPassing || null,
    gradeOrPercentage: payload.gradeOrPercentage || null,
    employeeId: payload.employeeId || null,
    employeeDesignation: payload.employeeDesignation || null,
    employeeDepartment: payload.employeeDepartment || null,
    employmentType: payload.employmentType || null,
    joiningDate: normalizeDateOfBirth(payload.joiningDate) ?? null,
    workLocation: payload.workLocation || null,
    currentEmployer: payload.currentEmployer || null,
    currentAddress: payload.currentAddress || null,
    permanentAddress: payload.permanentAddress || null,
    status: 'PENDING',
    createdById: currentUser?.id || null,
  });

  return toDto(candidate);
};

const getById = async ({ id, companyId }) => {
  const candidate = await repo.findById(id, companyId);
  if (!candidate) throw new NotFoundError('Candidate not found');
  return toDto(candidate);
};

const buildFormPdf = async ({ id, companyId, clientId }) => {
  const candidate = await repo.findById(id, companyId);
  if (!candidate || (clientId && candidate.clientId !== clientId)) throw new NotFoundError('Candidate not found');
  return createCandidateFormPdf(toDto(candidate));
};

const list = async ({ companyId, query }) => {
  const result = await repo.list({
    companyId,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    clientId: query.clientId,
    subclientId: query.subclientId,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    sortBy: ['candidateCode', 'firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt',
    sortOrder: ['asc', 'desc'].includes(query.sortOrder) ? query.sortOrder : 'desc',
    includeDeleted: query.includeDeleted === 'true',
  });

  return { items: result.items.map(toDto), total: result.total };
};

const listForExport = async ({ companyId, query }) => repo.listForExport({
  companyId,
  candidateId: query.candidateId,
  search: query.search,
  clientId: query.clientId,
  subclientId: query.subclientId,
  status: query.status,
  dateFrom: query.dateFrom,
  dateTo: query.dateTo,
  sortBy: ['candidateCode', 'firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'].includes(query.sortBy)
    ? query.sortBy
    : 'createdAt',
  sortOrder: ['asc', 'desc'].includes(query.sortOrder) ? query.sortOrder : 'desc',
});

const update = async ({ id, companyId, payload, currentUser }) => {
  const existing = await repo.findById(id, companyId);
  if (!existing) throw new NotFoundError('Candidate not found');
  const completedCase = await prisma.bGVCase.findFirst({
    where: { candidateId: id, companyId, status: 'COMPLETED' },
    select: { id: true },
  });
  if (completedCase) throw new ConflictError('Candidate details cannot be changed after the BGV case is completed.');

  if (payload.clientId && payload.clientId !== existing.clientId) {
    await assertClientBelongsToCompany(payload.clientId, companyId);
  }
  if (payload.subclientId !== undefined) {
    await assertSubclientBelongsToClient(payload.subclientId, payload.clientId || existing.clientId, companyId);
  } else if (payload.clientId && payload.clientId !== existing.clientId && existing.subclientId) {
    await assertSubclientBelongsToClient(existing.subclientId, payload.clientId, companyId);
  }
  validateIdentityValues(payload);

  const normalizedEmail = payload.email?.trim().toLowerCase() || null;

  const data = {};
  if (hasCandidateName(payload)) Object.assign(data, normalizeCandidateName(payload, existing));
  ['clientId', 'subclientId', 'email', 'phone', 'dateOfBirth', 'gender', 'fatherName', 'motherName', 'aadhaarNumber', 'panNumber', 'uanNumber', 'passportNumber', 'drivingLicenseNumber', 'voterIdNumber', 'highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage', 'employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer', 'currentAddress', 'permanentAddress', 'status']
    .forEach((field) => {
      if (payload[field] !== undefined) {
        if (field === 'clientId' && !payload[field]) return;
        data[field] = field === 'subclientId'
          ? payload[field] || null
          : IDENTITY_FIELDS.some((identityField) => identityField.key === field)
          ? normalizeIdentityValue(field, payload[field]) || null
          : field === 'email'
          ? (payload[field]?.trim().toLowerCase() || null)
          : ['dateOfBirth', 'joiningDate'].includes(field)
            ? normalizeDateOfBirth(payload[field])
            : payload[field];
      }
    });
  data.updatedById = currentUser?.id || null;

  return toDto(await repo.update(id, data));
};

const remove = async ({ id, companyId }) => {
  const existing = await repo.findById(id, companyId);
  if (!existing) throw new NotFoundError('Candidate not found');
  if ((existing._count?.bgvCases || 0) > 0) {
    throw new ConflictError('Candidates with BGV cases cannot be deleted.');
  }
  await repo.softDelete(id);
};

module.exports = { create, getById, buildFormPdf, list, listForExport, update, remove };
