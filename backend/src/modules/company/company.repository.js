'use strict';

const { prisma } = require('../../common/prisma');

const create = (data) => prisma.company.create({ data });

const findById = (id, { includeDeleted = false } = {}) =>
  prisma.company.findFirst({
    where: { id, ...(includeDeleted ? {} : { isDeleted: false }) },
  });

const findBySlug = (slug) =>
  prisma.company.findFirst({ where: { slug, isDeleted: false } });

const update = (id, data) => prisma.company.update({ where: { id }, data });

const softDelete = (id) =>
  prisma.company.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), status: 'INACTIVE' },
  });

const list = async ({ skip, limit, search, status, sortBy, sortOrder, includeDeleted }) => {
  const where = {
    ...(includeDeleted ? {} : { isDeleted: false }),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { contactEmail: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        users: {
          where: { isDeleted: false, role: { isCompanyAdmin: true } },
          select: { firstName: true, lastName: true, email: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    }),
    prisma.company.count({ where }),
  ]);
  return { items, total };
};

const setStatus = (id, status) => prisma.company.update({ where: { id }, data: { status } });

module.exports = { create, findById, findBySlug, update, softDelete, list, setStatus };
