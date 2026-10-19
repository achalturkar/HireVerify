'use strict';

const fs = require('fs/promises');
const path = require('path');
const { prisma } = require('../../common/prisma');
const repo = require('./client.repository');
const { normalizeConfig, validateConfig, CUSTOM_FORM_CATEGORIES } = require('./candidate-intake-config');
const { getTemplatePath, getLegacyTemplatePath, getLegacyTemplatePathFromUrl, findTemplatePath, TEMPLATE_EXTENSIONS } = require('./candidate-form-storage');

const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require('../../utils/errors');

/**
 * Convert Prisma entity to DTO
 */
const toDto = (client) => ({
  id: client.id,
  companyId: client.companyId,
  parentClientId: client.parentClientId || null,
  clientCode: client.clientCode,
  name: client.name,
  logoUrl: client.logoUrl,
  reportShowCompanyBranding: client.reportShowCompanyBranding,
  reportShowClientBranding: client.reportShowClientBranding,
  candidateFormConfig: normalizeConfig(client.candidateFormConfig),
  serviceRates: Array.isArray(client.serviceRates) ? client.serviceRates : [],
  packageRate: client.packageRate === null || client.packageRate === undefined ? null : Number(client.packageRate),
  website: client.website,
  industry: client.industry,
  contactName: client.contactName,
  contactEmail: client.contactEmail,
  contactPhone: client.contactPhone,
  gstNumber: client.gstNumber,
  panNumber: client.panNumber,
  addressLine1: client.addressLine1,
  addressLine2: client.addressLine2,
  city: client.city,
  state: client.state,
  country: client.country,
  postalCode: client.postalCode,
  status: client.status,
  isDeleted: client.isDeleted,
  createdById: client.createdById,
  updatedById: client.updatedById,
  createdAt: client.createdAt,
  updatedAt: client.updatedAt,
});

/**
 * Create Client
 */
const create = async ({ payload, currentUser, req }) => {
  const {
    companyId,
    clientCode,
    name,
    logoUrl,
    website,
    industry,
    contactName,
    contactEmail,
    contactPhone,
    gstNumber,
    panNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
  } = payload;

  if (!companyId) {
    throw new BadRequestError('Company is required');
  }

  if (!clientCode) {
    throw new BadRequestError('Client code is required');
  }

  if (!name) {
    throw new BadRequestError('Client name is required');
  }

  const resolvedLogoUrl = req?.file ? `/uploads/clients/${req.file.filename}` : (logoUrl || '').trim() || null;

  // Company validation
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      isDeleted: false,
    },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  // Duplicate Code
  const existingCode = await prisma.client.findUnique({ where: { clientCode } });

  if (existingCode) {
    if (existingCode.isDeleted) {
      throw new ConflictError(`Client code ${clientCode} belongs to a deleted client. Restore that client to reuse its existing record.`);
    }
    throw new ConflictError('Client code already exists');
  }

  // Duplicate Name inside Company
  const existingName = await repo.findByName(companyId, name);

  if (existingName) {
    throw new ConflictError(
      'Client with same name already exists.'
    );
  }

  // Duplicate Email
  if (contactEmail) {
    const existingEmail = await repo.findByEmail(
      companyId,
      contactEmail
    );

    if (existingEmail) {
      throw new ConflictError(
        'Client email already exists.'
      );
    }
  }

  const client = await repo.create({
    companyId,
    clientCode,
    name,
    logoUrl: resolvedLogoUrl,
    website,
    industry,
    contactName,
    contactEmail,
    contactPhone,
    gstNumber,
    panNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    status: 'ACTIVE',
    createdById: currentUser?.id || null,
  });

  return toDto(client);
};

/**
 * Get Client By Id
 */
const getById = async ({ id, companyId }) => {
  const client = await repo.findById(id, companyId);

  if (!client) {
    throw new NotFoundError('Client not found');
  }

  return toDto(client);
};

/**
 * List Clients
 */
const list = async ({ companyId, query }) => {
  const result = await repo.list({
    companyId,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    status: query.status,
    sortBy: ['name', 'clientCode', 'createdAt', 'updatedAt', 'status']
      .includes(query.sortBy)
      ? query.sortBy
      : 'createdAt',
    sortOrder: query.sortOrder,
    includeDeleted: query.includeDeleted === 'true',
    deletedOnly: query.deletedOnly === 'true',
  });

  return {
    items: result.items.map((client) => ({
      ...toDto(client),
      candidateCount: client._count?.candidates ?? 0,
      bgvCaseCount: client._count?.bgvCases ?? 0,
    })),
    total: result.total,
  };
};

const normalizeServiceRates = async (value, previouslyConfigured = new Set()) => {
  if (!Array.isArray(value)) throw new BadRequestError('Checks and rates must be provided as a list.');
  if (value.length === 0) throw new BadRequestError('Select at least one background check for the subclient package.');
  const requestedTypes = value.map((entry) => String(entry?.checkType || '').trim());
  const registeredTypes = await prisma.verificationCheckType.findMany({
    where: { type: { in: requestedTypes } },
    select: { type: true, isActive: true },
  });
  const typeMap = new Map(registeredTypes.map((item) => [item.type, item]));
  const seen = new Set();
  return value.map((entry) => {
    const checkType = String(entry?.checkType || '').trim();
    const rate = Number(entry?.rate);
    const definition = typeMap.get(checkType);
    if (!definition || (!definition.isActive && !previouslyConfigured.has(checkType))) throw new BadRequestError('Choose an available background check for every subclient rate.');
    if (seen.has(checkType)) throw new BadRequestError('A check can only be configured once per subclient.');
    if (!Number.isFinite(rate) || rate < 0 || rate > 100000000) throw new BadRequestError('Each check rate must be between 0 and 100,000,000.');
    seen.add(checkType);
    return { checkType, rate };
  });
};

const normalizePackageRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100000000) {
    throw new BadRequestError('Package rate must be between 0 and 100,000,000 INR.');
  }
  return rate;
};

const getSubclients = async ({ parentClientId, companyId }) => {
  const parent = await prisma.client.findFirst({
    where: { id: parentClientId, companyId, parentClientId: null, isDeleted: false },
    select: { id: true },
  });
  if (!parent) throw new NotFoundError('Client not found');
  return (await repo.listSubclients(parentClientId)).map((child) => ({
    ...toDto(child),
    candidateCount: child._count?.subclientCandidates ?? 0,
    bgvCaseCount: child._count?.subclientCases ?? 0,
  }));
};

const createSubclient = async ({ parentClientId, companyId, payload, currentUser }) => {
  const parent = await prisma.client.findFirst({
    where: { id: parentClientId, companyId, parentClientId: null, isDeleted: false },
    select: { id: true },
  });
  if (!parent) throw new NotFoundError('Client not found');
  const name = payload.name?.trim();
  const clientCode = payload.clientCode?.trim();
  if (!name || !clientCode) throw new BadRequestError('Subclient name and code are required.');
  const existing = await prisma.client.findUnique({ where: { clientCode } });
  if (existing) throw new ConflictError('Client code already exists');
  const sibling = await prisma.client.findFirst({
    where: { companyId, parentClientId, name: { equals: name, mode: 'insensitive' }, isDeleted: false },
    select: { id: true },
  });
  if (sibling) throw new ConflictError('A subclient with this name already exists under the client.');
  const serviceRates = await normalizeServiceRates(payload.serviceRates || []);
  const packageRate = normalizePackageRate(payload.packageRate);
  const created = await repo.create({
    companyId,
    parentClientId,
    name,
    clientCode,
    industry: payload.industry?.trim() || null,
    contactName: payload.contactName?.trim() || null,
    contactEmail: payload.contactEmail?.trim().toLowerCase() || null,
    contactPhone: payload.contactPhone?.trim() || null,
    gstNumber: payload.gstNumber?.trim() || null,
    panNumber: payload.panNumber?.trim() || null,
    addressLine1: payload.addressLine1?.trim() || null,
    addressLine2: payload.addressLine2?.trim() || null,
    city: payload.city?.trim() || null,
    state: payload.state?.trim() || null,
    country: payload.country?.trim() || null,
    postalCode: payload.postalCode?.trim() || null,
    serviceRates,
    packageRate,
    status: 'ACTIVE',
    createdById: currentUser?.id || null,
  });
  return toDto(created);
};

const updateSubclient = async ({ parentClientId, subclientId, companyId, payload }) => {
  const current = await prisma.client.findFirst({
    where: { id: subclientId, parentClientId, companyId, isDeleted: false },
  });
  if (!current) throw new NotFoundError('Subclient not found');
  const data = {};
  for (const key of ['name', 'clientCode', 'industry', 'contactName', 'contactEmail', 'contactPhone', 'gstNumber', 'panNumber', 'addressLine1', 'addressLine2', 'city', 'state', 'country', 'postalCode', 'status']) {
    if (payload[key] !== undefined) data[key] = typeof payload[key] === 'string' ? payload[key].trim() || null : payload[key];
  }
  if (data.name === null) throw new BadRequestError('Subclient name is required.');
  if (data.clientCode === null) throw new BadRequestError('Subclient code is required.');
  if (data.contactEmail) data.contactEmail = data.contactEmail.toLowerCase();
  if (payload.serviceRates !== undefined) data.serviceRates = await normalizeServiceRates(payload.serviceRates, new Set((current.serviceRates || []).map((entry) => entry.checkType)));
  if (payload.packageRate !== undefined) data.packageRate = normalizePackageRate(payload.packageRate);
  if (data.clientCode && data.clientCode !== current.clientCode) {
    const existing = await prisma.client.findUnique({ where: { clientCode: data.clientCode } });
    if (existing) throw new ConflictError('Client code already exists');
  }
  if (data.name && data.name.toLocaleLowerCase() !== current.name.toLocaleLowerCase()) {
    const sibling = await prisma.client.findFirst({
      where: { companyId, parentClientId, name: { equals: data.name, mode: 'insensitive' }, isDeleted: false },
      select: { id: true },
    });
    if (sibling) throw new ConflictError('A subclient with this name already exists under the client.');
  }
  return toDto(await repo.update(subclientId, data));
};

const removeSubclient = async ({ parentClientId, subclientId, companyId }) => {
  const child = await prisma.client.findFirst({
    where: { id: subclientId, parentClientId, companyId, isDeleted: false },
    select: { id: true },
  });
  if (!child) throw new NotFoundError('Subclient not found');
  await repo.softDelete(subclientId);
};

/**
 * Update Client
 */
const update = async ({
  id,
  companyId,
  payload,
  currentUser,
  req,
}) => {
  const existing = await repo.findById(id, companyId);

  if (!existing) {
    throw new NotFoundError('Client not found');
  }
  const showCompanyBranding = payload.reportShowCompanyBranding ?? existing.reportShowCompanyBranding;
  const showClientBranding = payload.reportShowClientBranding ?? existing.reportShowClientBranding;
  if (!showCompanyBranding && !showClientBranding) {
    throw new BadRequestError('Keep company branding or client branding enabled for reports.');
  }

  // Duplicate Client Name
  if (
    payload.name &&
    payload.name !== existing.name
  ) {
    const duplicate = await repo.findByName(
      companyId,
      payload.name
    );

    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(
        'Client name already exists.'
      );
    }
  }

  // Duplicate Email
  if (
    payload.contactEmail &&
    payload.contactEmail !== existing.contactEmail
  ) {
    const duplicateEmail = await repo.findByEmail(
      companyId,
      payload.contactEmail
    );

    if (
      duplicateEmail &&
      duplicateEmail.id !== id
    ) {
      throw new ConflictError(
        'Client email already exists.'
      );
    }
  }

  // Duplicate Client Code
  if (
    payload.clientCode &&
    payload.clientCode !== existing.clientCode
  ) {
    const duplicateCode =
      await prisma.client.findFirst({
        where: {
          clientCode: payload.clientCode,
          isDeleted: false,
        },
      });

    if (
      duplicateCode &&
      duplicateCode.id !== id
    ) {
      throw new ConflictError(
        'Client code already exists.'
      );
    }
  }

  const data = {};

  if (req?.file) {
    data.logoUrl = `/uploads/clients/${req.file.filename}`;
  }

  [
    'clientCode',
    'name',
    'logoUrl',
    'reportShowCompanyBranding',
    'reportShowClientBranding',
    'website',
    'industry',
    'contactName',
    'contactEmail',
    'contactPhone',
    'gstNumber',
    'panNumber',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'country',
    'postalCode',
    'status',
  ].forEach((field) => {
    if (payload[field] !== undefined) {
      data[field] = payload[field];
    }
  });
  if (payload.candidateFormConfig !== undefined) {
    data.candidateFormConfig = validateConfig(payload.candidateFormConfig, id);
  }

  data.updatedById = currentUser?.id || null;

  const updated = await repo.update(id, data);

  return toDto(updated);
};

const addCandidateFormTemplate = async ({ id, companyId, userId, file, name, category, required }) => {
  try {
    if (!file) throw new BadRequestError('Choose a PDF, DOC, or DOCX form template to upload.');
    const client = await repo.findById(id, companyId);
    if (!client) throw new NotFoundError('Client not found');
    const label = String(name || '').trim();
    if (!label || label.length > 100) throw new BadRequestError('Form name must be between 1 and 100 characters.');
    if (!CUSTOM_FORM_CATEGORIES.includes(category)) throw new BadRequestError('Choose a valid form category.');
    if (!['true', 'false', true, false].includes(required)) throw new BadRequestError('Form required setting is invalid.');

    const signature = await fs.readFile(file.path);
    const extension = path.extname(file.originalname).toLowerCase();
    const validSignature = extension === '.pdf'
      ? file.mimetype === 'application/pdf' && signature.subarray(0, 5).toString() === '%PDF-'
      : extension === '.doc'
        ? ['application/msword', 'application/vnd.ms-word'].includes(file.mimetype)
          && signature.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
        : extension === '.docx'
          ? file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            && signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
          : false;
    if (!validSignature) {
      throw new BadRequestError('The uploaded file must be a valid PDF, DOC, or DOCX document.');
    }
    const formId = path.basename(file.filename, extension);
    if (!TEMPLATE_EXTENSIONS.has(extension) || !/^[0-9a-f-]{36}$/i.test(formId) || path.resolve(file.path) !== getTemplatePath(id, formId, file.filename)) {
      throw new BadRequestError('The candidate form template upload path is invalid.');
    }
    const config = normalizeConfig(client.candidateFormConfig);
    if (config.customForms.length >= 20) throw new BadRequestError('A client can have at most 20 candidate form templates.');
    if (category === 'POLICE_VERIFICATION') config.sections.policeVerification.enabled = true;
    config.customForms.push({
      id: formId,
      name: label,
      category,
      enabled: true,
      required: required === 'true' || required === true,
      fileName: path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || `${label}${extension}`,
    });
    const updated = await repo.update(id, {
      candidateFormConfig: validateConfig(config),
      updatedById: userId || null,
    });
    return toDto(updated);
  } catch (error) {
    if (file?.path) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') throw cleanupError;
      }
    }
    throw error;
  }
};

const removeCandidateFormTemplate = async ({ id, companyId, userId, formId }) => {
  const client = await repo.findById(id, companyId);
  if (!client) throw new NotFoundError('Client not found');
  const candidateFormConfig = validateConfig(client.candidateFormConfig, id);
  const legacyFileUrl = client.candidateFormConfig?.customForms?.find((item) => item.id === formId)?.fileUrl;
  const form = candidateFormConfig.customForms.find((item) => item.id === formId);
  if (!form) throw new NotFoundError('Candidate form template not found.');
  candidateFormConfig.customForms = candidateFormConfig.customForms.filter((item) => item.id !== formId);
  const updated = await repo.update(id, { candidateFormConfig: validateConfig(candidateFormConfig, id), updatedById: userId || null });
  for (const filePath of [
    ...[...TEMPLATE_EXTENSIONS].map((extension) => getTemplatePath(id, formId, `${formId}${extension}`)),
    getLegacyTemplatePath(id, formId),
    getLegacyTemplatePathFromUrl(id, legacyFileUrl),
  ].filter((filePath, index, paths) => filePath && paths.indexOf(filePath) === index)) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return toDto(updated);
};

const getCandidateFormTemplate = async ({ id, companyId, formId }) => {
  const client = await repo.findById(id, companyId);
  if (!client) throw new NotFoundError('Client not found');
  const form = validateConfig(client.candidateFormConfig, id).customForms.find((item) => item.id === formId);
  if (!form) throw new NotFoundError('Candidate form template not found.');
  const legacyFileUrl = client.candidateFormConfig?.customForms?.find((item) => item.id === formId)?.fileUrl;
  const filePath = await findTemplatePath(id, formId, legacyFileUrl, form.fileName);
  if (!filePath) throw new NotFoundError('Candidate form template file is missing.');
  return { filePath, fileName: form.fileName };
};

/**
 * Soft Delete Client
 */
const remove = async ({ id, companyId }) => {
  const existing = await repo.findById(id, companyId);

  if (!existing) {
    throw new NotFoundError('Client not found');
  }

  const candidateCount = existing._count?.candidates ?? 0;
  const bgvCaseCount = existing._count?.bgvCases ?? 0;
  if (candidateCount > 0 || bgvCaseCount > 0) {
    throw new ConflictError(
      `Cannot delete this client while it has ${candidateCount} candidate${candidateCount === 1 ? '' : 's'} and ${bgvCaseCount} BGV case${bgvCaseCount === 1 ? '' : 's'}. Remove its candidates and cases first.`,
    );
  }

  await repo.softDelete(id);
};

/**
 * Activate Client
 */
const activate = async ({ id, companyId }) => {
  const existing = await repo.findById(id, companyId, {
    includeDeleted: true,
  });

  if (!existing) {
    throw new NotFoundError('Client not found');
  }

  if (existing.isDeleted) {
    throw new BadRequestError(
      'Deleted client cannot be activated.'
    );
  }

  if (existing.status === 'ACTIVE') {
    throw new BadRequestError(
      'Client is already active.'
    );
  }

  const updated = await repo.setStatus(id, 'ACTIVE');

  return toDto(updated);
};

/**
 * Inactivate Client
 */
const inactivate = async ({ id, companyId }) => {
  const existing = await repo.findById(id, companyId);

  if (!existing) {
    throw new NotFoundError('Client not found');
  }

  if (existing.status === 'INACTIVE') {
    throw new BadRequestError(
      'Client is already inactive.'
    );
  }

  const updated = await repo.setStatus(id, 'INACTIVE');

  return toDto(updated);
};

const restore = async ({ id, companyId }) => {
  const existing = await repo.findById(id, companyId, { includeDeleted: true });
  if (!existing) throw new NotFoundError('Client not found');
  if (!existing.isDeleted) throw new BadRequestError('Client is already active.');

  const duplicateName = await repo.findByName(companyId, existing.name);
  if (duplicateName) throw new ConflictError('Another active client already uses this name. Resolve the duplicate before restoring this client.');
  if (existing.contactEmail) {
    const duplicateEmail = await repo.findByEmail(companyId, existing.contactEmail);
    if (duplicateEmail) throw new ConflictError('Another active client already uses this email. Resolve the duplicate before restoring this client.');
  }

  return toDto(await repo.restore(id));
};

module.exports = {
  create,
  getById,
  list,
  getSubclients,
  createSubclient,
  updateSubclient,
  removeSubclient,
  addCandidateFormTemplate,
  removeCandidateFormTemplate,
  getCandidateFormTemplate,
  update,
  remove,
  activate,
  inactivate,
  restore,
};