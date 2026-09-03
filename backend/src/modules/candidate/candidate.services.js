'use strict';

const { prisma } = require('../../common/prisma');
const repo = require('./candidate.repository');

const { NotFoundError, ConflictError, BadRequestError } = require('../../utils/errors');

const toDto = (candidate) => ({
  id: candidate.id,
  companyId: candidate.companyId,
  clientId: candidate.clientId,
  candidateCode: candidate.candidateCode,
  firstName: candidate.firstName,
  lastName: candidate.lastName,
  email: candidate.email,
  phone: candidate.phone,
  dateOfBirth: candidate.dateOfBirth,
  gender: candidate.gender,
  currentAddress: candidate.currentAddress,
  permanentAddress: candidate.permanentAddress,
  status: candidate.status,
  createdById: candidate.createdById,
  updatedById: candidate.updatedById,
  createdAt: candidate.createdAt,
  updatedAt: candidate.updatedAt,
  bgvCaseCount: candidate._count?.bgvCases,
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

const normalizeDateOfBirth = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Date of birth must be a valid date');
  return date;
};

const assertClientBelongsToCompany = async (clientId, companyId) => {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, isDeleted: false },
    select: { id: true },
  });

  if (!client) throw new NotFoundError('Client not found');
};

const create = async ({ payload, companyId, currentUser }) => {
  const { clientId, firstName, lastName, email, phone } = payload;

  if (!clientId) throw new BadRequestError('Client is required');
  if (!firstName || !lastName) throw new BadRequestError('First name and last name are required');
  if (!email) throw new BadRequestError('Email is required');

  await assertClientBelongsToCompany(clientId, companyId);

  const existing = await repo.findByEmail(companyId, clientId, email);
  if (existing) throw new ConflictError('A candidate with this email already exists for this client.');

  const candidate = await repo.create({
    companyId,
    clientId,
    candidateCode: await createCandidateCode(clientId, companyId),
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone: phone || null,
    dateOfBirth: normalizeDateOfBirth(payload.dateOfBirth) ?? null,
    gender: payload.gender || null,
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

const list = async ({ companyId, query }) => {
  const result = await repo.list({
    companyId,
    skip: query.skip,
    limit: query.limit,
    search: query.search,
    clientId: query.clientId,
    status: query.status,
    sortBy: ['candidateCode', 'firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt',
    sortOrder: ['asc', 'desc'].includes(query.sortOrder) ? query.sortOrder : 'desc',
    includeDeleted: query.includeDeleted === 'true',
  });

  return { items: result.items.map(toDto), total: result.total };
};

const update = async ({ id, companyId, payload, currentUser }) => {
  const existing = await repo.findById(id, companyId);
  if (!existing) throw new NotFoundError('Candidate not found');

  if (payload.clientId && payload.clientId !== existing.clientId) {
    await assertClientBelongsToCompany(payload.clientId, companyId);
  }

  if (payload.email && payload.email.toLowerCase() !== existing.email.toLowerCase()) {
    const duplicate = await repo.findByEmail(companyId, payload.clientId || existing.clientId, payload.email);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError('A candidate with this email already exists for this client.');
    }
  }

  const data = {};
  ['clientId', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'currentAddress', 'permanentAddress', 'status']
    .forEach((field) => {
      if (payload[field] !== undefined) {
        data[field] = field === 'email'
          ? payload[field].toLowerCase()
          : field === 'dateOfBirth'
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
  await repo.softDelete(id);
};

module.exports = { create, getById, list, update, remove };
