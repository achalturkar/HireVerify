'use strict';

const { prisma } = require('../../common/prisma');
const repo = require('./client.repository');
const { normalizeConfig, validateConfig } = require('./candidate-intake-config');

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

const CHECK_TYPES = new Set([
  'PAN', 'UAN', 'COURT', 'IDENTITY', 'ADDRESS', 'ADDRESS_PHYSICAL', 'EDUCATION',
  'EMPLOYMENT', 'GAP', 'REFERENCE', 'CV', 'SOCIAL_MEDIA', 'DOCUMENT',
  'DOCUMENT_FORGERY', 'CIBIL', 'TWENTY_SIX_AS', 'POLICE', 'POLICE_RECORD',
]);

const normalizeServiceRates = (value) => {
  if (!Array.isArray(value)) throw new BadRequestError('Checks and rates must be provided as a list.');
  if (value.length === 0) throw new BadRequestError('Select at least one background check for the subclient package.');
  const seen = new Set();
  return value.map((entry) => {
    const checkType = String(entry?.checkType || '').trim();
    const rate = Number(entry?.rate);
    if (!CHECK_TYPES.has(checkType)) throw new BadRequestError('Choose a valid background check for every subclient rate.');
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
  const serviceRates = normalizeServiceRates(payload.serviceRates || []);
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
  if (payload.serviceRates !== undefined) data.serviceRates = normalizeServiceRates(payload.serviceRates);
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
    data.candidateFormConfig = validateConfig(payload.candidateFormConfig);
  }

  data.updatedById = currentUser?.id || null;

  const updated = await repo.update(id, data);

  return toDto(updated);
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
  update,
  remove,
  activate,
  inactivate,
  restore,
};