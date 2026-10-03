'use strict';

const { prisma } = require('../../common/prisma');
const repo = require('./client.repository');

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
  clientCode: client.clientCode,
  name: client.name,
  logoUrl: client.logoUrl,
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
  update,
  remove,
  activate,
  inactivate,
  restore,
};