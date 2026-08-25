'use strict';

const { prisma } = require('../../common/prisma');
const repo = require('./bgv-case.repository');
const { NotFoundError, BadRequestError, ConflictError } = require('../../utils/errors');
const { buildReport } = require('./bgv-report.generator');

const TRANSITIONS = {
  DRAFT: ['INITIATED', 'COMPLETED', 'CANCELLED'],
  INITIATED: ['CONSENT_PENDING', 'IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  CONSENT_PENDING: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['UNDER_REVIEW', 'ON_HOLD', 'CANCELLED'],
  UNDER_REVIEW: ['COMPLETED', 'IN_PROGRESS', 'ON_HOLD'],
  ON_HOLD: ['INITIATED', 'CONSENT_PENDING', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const toDto = (item) => item;

const nextCaseNumber = async (companyId) => {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { shortCode: true } });
  const shortCode = company?.shortCode || 'BGV';
  const count = await repo.countByCompany(companyId);
  return `${shortCode}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

const assertOwnership = async ({ companyId, clientId, candidateId }) => {
  const [client, candidate] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, companyId, isDeleted: false }, select: { id: true } }),
    prisma.candidate.findFirst({ where: { id: candidateId, companyId, clientId, isDeleted: false }, select: { id: true } }),
  ]);
  if (!client) throw new NotFoundError('Client not found');
  if (!candidate) throw new NotFoundError('Candidate not found for this client');
};

const create = async ({ payload, companyId, currentUser }) => {
  await assertOwnership({ companyId, clientId: payload.clientId, candidateId: payload.candidateId });
  const caseNumber = await nextCaseNumber(companyId);
  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.bGVCase.create({ data: { companyId, clientId: payload.clientId, candidateId: payload.candidateId, caseNumber, clientReference: payload.clientReference || null, packageName: payload.packageName || null, remarks: payload.remarks || null, createdById: currentUser?.id || null } });
    const checks = payload.checks || [];
    if (checks.length) await tx.verificationCheck.createMany({ data: checks.map((check) => ({ caseId: item.id, type: check.type, provider: check.provider || 'SUREPASS', priority: check.priority || 0 })) });
    await tx.verificationEvent.create({ data: { caseId: item.id, eventType: 'CREATED', message: 'BGV case created' } });
    return item;
  });
  return repo.findById(created.id, companyId);
};

const getById = async ({ id, companyId }) => {
  const item = await repo.findById(id, companyId);
  if (!item) throw new NotFoundError('BGV case not found');
  return toDto(item);
};

const list = async ({ companyId, query }) => {
  const result = await repo.list({ companyId, ...query, sortBy: ['caseNumber', 'status', 'overallResult', 'createdAt', 'updatedAt'].includes(query.sortBy) ? query.sortBy : 'createdAt', sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc' });
  return { items: result.items.map(toDto), total: result.total };
};

const transition = async ({ id, companyId, status, remarks, currentUser }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('BGV case not found');
  if (!TRANSITIONS[current.status]?.includes(status)) throw new BadRequestError(`Cannot move case from ${current.status} to ${status}`);
  const data = { status, updatedById: currentUser?.id || null, ...(remarks !== undefined ? { remarks } : {}) };
  if (status === 'INITIATED' && !current.initiatedAt) data.initiatedAt = new Date();
  if (status === 'COMPLETED') data.completedAt = new Date();
  await repo.update(id, data);
  await repo.createEvent({ caseId: id, eventType: 'STATUS_CHANGED', status: null, message: `${current.status} -> ${status}`, metadata: { from: current.status, to: status, userId: currentUser?.id || null } });
  return getById({ id, companyId });
};

const updateMeta = async ({ id, companyId, payload, currentUser }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('BGV case not found');
  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') throw new ConflictError('This case is finalized and cannot be edited.');
  await repo.updateMeta(id, {
    clientReference: payload.clientReference,
    packageName: payload.packageName,
    initiatedAt: payload.initiatedAt ? new Date(payload.initiatedAt) : undefined,
    completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
    remarks: payload.remarks,
    updatedById: currentUser?.id || null,
  });
  return getById({ id, companyId });
};

const updateChecks = async ({ id, companyId, checks, currentUser }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('BGV case not found');
  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') throw new ConflictError('This case is finalized and cannot be edited.');

  const requested = new Map(checks.map((check) => [check.type, check]));
  const existing = new Map((current.checks || []).map((check) => [check.type, check]));
  const protectedChecks = (current.checks || []).filter((check) => !requested.has(check.type) && (
    check.status !== 'PENDING' || check.resultData || check.remarks || check.documents?.length
  ));
  if (protectedChecks.length) throw new ConflictError(`Completed or edited checks cannot be removed: ${protectedChecks.map((check) => check.type).join(', ')}`);

  await prisma.$transaction(async (tx) => {
    const removeIds = (current.checks || []).filter((check) => !requested.has(check.type)).map((check) => check.id);
    if (removeIds.length) await tx.verificationCheck.deleteMany({ where: { id: { in: removeIds }, caseId: id } });
    const addChecks = [...requested.entries()]
      .filter(([type]) => !existing.has(type))
      .map(([, check]) => ({ caseId: id, type: check.type, provider: check.provider || 'MANUAL', priority: check.priority || 0 }));
    if (addChecks.length) await tx.verificationCheck.createMany({ data: addChecks });
    await tx.bGVCase.update({ where: { id }, data: { updatedById: currentUser?.id || null } });
  });
  return getById({ id, companyId });
};

const remove = async ({ id, companyId }) => {
  const current = await repo.findById(id, companyId);
  if (!current) throw new NotFoundError('BGV case not found');
  if (!['DRAFT', 'CANCELLED'].includes(current.status)) {
    throw new ConflictError('Only draft or cancelled BGV cases can be deleted.');
  }
  await repo.remove(id);
};

const generateReport = async ({ id, companyId }) => {
  const item = await getById({ id, companyId });
  return buildReport(item);
};

module.exports = { create, getById, list, transition, updateMeta, updateChecks, remove, buildReport: generateReport, TRANSITIONS };
