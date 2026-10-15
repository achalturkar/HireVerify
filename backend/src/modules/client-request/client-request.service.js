'use strict';

const { prisma } = require('../../common/prisma');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');

const requestInclude = {
  client: { select: { id: true, name: true, clientCode: true } },
  submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  respondedBy: { select: { id: true, firstName: true, lastName: true } },
};

const toDto = (item) => ({
  id: item.id,
  clientId: item.clientId,
  client: item.client,
  category: item.category,
  subject: item.subject,
  description: item.description,
  status: item.status,
  adminResponse: item.adminResponse,
  respondedAt: item.respondedAt,
  respondedBy: item.respondedBy,
  submittedBy: item.submittedBy,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const create = async ({ currentUser, payload }) => {
  if (!currentUser.role?.isClientUser || !currentUser.clientId || !currentUser.companyId) {
    throw new ForbiddenError('A client portal account is required to submit a request.');
  }

  const client = await prisma.client.findFirst({
    where: { id: currentUser.clientId, companyId: currentUser.companyId, isDeleted: false },
    select: { id: true },
  });
  if (!client) throw new NotFoundError('Client account not found.');

  const request = await prisma.clientRequest.create({
    data: {
      companyId: currentUser.companyId,
      clientId: client.id,
      submittedById: currentUser.id,
      category: payload.category,
      subject: payload.subject,
      description: payload.description,
    },
    include: requestInclude,
  });

  return toDto(request);
};

const list = async ({ currentUser, page, limit, search, status }) => {
  let where;
  if (currentUser.role?.isClientUser && currentUser.clientId && currentUser.companyId) {
    where = { companyId: currentUser.companyId, clientId: currentUser.clientId };
  } else if (currentUser.role?.isCompanyAdmin && currentUser.companyId) {
    where = { companyId: currentUser.companyId };
  } else {
    throw new ForbiddenError('Only client users and company administrators can view client requests.');
  }

  if (status) where.status = status;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } },
      { submittedBy: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.clientRequest.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: requestInclude,
    }),
    prisma.clientRequest.count({ where }),
  ]);

  return {
    items: items.map(toDto),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const update = async ({ currentUser, id, payload }) => {
  if (!currentUser.role?.isCompanyAdmin || !currentUser.companyId) {
    throw new ForbiddenError('Only company administrators can update client requests.');
  }

  const existing = await prisma.clientRequest.findFirst({
    where: { id, companyId: currentUser.companyId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Client request not found.');

  const data = {};
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.adminResponse !== undefined) {
    data.adminResponse = payload.adminResponse;
    data.respondedAt = new Date();
    data.respondedById = currentUser.id;
  }

  const request = await prisma.clientRequest.update({
    where: { id },
    data,
    include: requestInclude,
  });

  return toDto(request);
};

module.exports = { create, list, update };
