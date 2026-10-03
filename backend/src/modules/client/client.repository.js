'use strict';

const { prisma } = require('../../common/prisma');

/**
 * Create Client
 */
const create = (data) =>
  prisma.client.create({
    data,
  });

/**
 * Find Client By ID
 */
const findById = (
  id,
  companyId,
  { includeDeleted = false } = {}
) =>
  prisma.client.findFirst({
    where: {
      id,
      companyId,
      ...(includeDeleted ? {} : { isDeleted: false }),
    },
    include: { _count: { select: { candidates: true, bgvCases: true } } },
  });

/**
 * Find Client By Name
 * Used to prevent duplicate client names within same company.
 */
const findByName = (companyId, name) =>
  prisma.client.findFirst({
    where: {
      companyId,
      name: {
        equals: name,
        mode: 'insensitive',
      },
      isDeleted: false,
    },
  });

/**
 * Find Client By Email
 */
const findByEmail = (companyId, contactEmail) =>
  prisma.client.findFirst({
    where: {
      companyId,
      contactEmail,
      isDeleted: false,
    },
  });

/**
 * Update Client
 */
const update = (id, data) =>
  prisma.client.update({
    where: { id },
    data,
  });

/**
 * Soft Delete
 */
const softDelete = (id) =>
  prisma.client.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
  });

const restore = (id) =>
  prisma.client.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null, status: 'ACTIVE' },
  });

/**
 * Activate / Suspend
 */
const setStatus = (id, status) =>
  prisma.client.update({
    where: { id },
    data: { status },
  });

/**
 * List Clients
 */
const list = async ({
  companyId,
  skip,
  limit,
  search,
  status,
  sortBy,
  sortOrder,
  includeDeleted,
  deletedOnly,
}) => {
  const where = {
    companyId,

    ...(deletedOnly ? { isDeleted: true } : includeDeleted ? {} : { isDeleted: false }),

    ...(status
      ? {
          status,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              clientCode: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              contactName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              contactEmail: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              contactPhone: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              industry: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
  prisma.client.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: { _count: { select: { candidates: true, bgvCases: true } } },
  }),

  prisma.client.count({
    where,
  }),
]);

    
  return {
    items,
    total,
  };
};

module.exports = {
  create,
  findById,
  findByName,
  findByEmail,
  update,
  softDelete,
  restore,
  setStatus,
  list,
};