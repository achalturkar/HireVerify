'use strict';

const { prisma } = require('../../common/prisma');

const create = (data) => prisma.candidate.create({ data });

const dateRange = (dateFrom, dateTo) => ({
  ...(dateFrom || dateTo ? {
    createdAt: {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    },
  } : {}),
});

const buildListWhere = ({ companyId, search, clientId, subclientId, status, dateFrom, dateTo, includeDeleted }) => ({
  companyId,
  ...(includeDeleted ? {} : { isDeleted: false }),
  ...(clientId ? { clientId } : {}),
  ...(subclientId === 'none' ? { subclientId: null } : subclientId ? { subclientId } : {}),
  ...(status ? { status } : {}),
  ...dateRange(dateFrom, dateTo),
  ...(search ? {
    OR: [
      { candidateCode: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ],
  } : {}),
});

const findById = (id, companyId, { includeDeleted = false } = {}) =>
  prisma.candidate.findFirst({
    where: { id, companyId, ...(includeDeleted ? {} : { isDeleted: false }) },
    include: {
      client: { select: { id: true, name: true, clientCode: true, contactEmail: true, contactPhone: true, candidateFormConfig: true } },
      subclient: { select: { id: true, name: true, clientCode: true, serviceRates: true } },
      _count: { select: { bgvCases: true } },
      documents: true,
      consents: {
        where: { consentType: 'BGV_CONSENT' },
        orderBy: { createdAt: 'desc' },
        select: { consentGiven: true, consentVersion: true, consentText: true, consentedAt: true, revokedAt: true, createdAt: true, caseId: true },
      },
      portalInvitation: { select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true } },
    },
  });

const update = (id, data) => prisma.candidate.update({ where: { id }, data });

const softDelete = (id) => prisma.candidate.update({
  where: { id },
  data: { isDeleted: true, deletedAt: new Date() },
});

const list = async ({ companyId, skip, limit, search, clientId, subclientId, status, dateFrom, dateTo, sortBy, sortOrder, includeDeleted }) => {
  const where = buildListWhere({ companyId, search, clientId, subclientId, status, dateFrom, dateTo, includeDeleted });

  const [items, total] = await Promise.all([
    prisma.candidate.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        client: { select: { id: true, name: true, clientCode: true, contactEmail: true, contactPhone: true } },
        subclient: { select: { id: true, name: true, clientCode: true, serviceRates: true } },
        _count: { select: { bgvCases: true } },
      },
    }),
    prisma.candidate.count({ where }),
  ]);

  return { items, total };
};

const listForExport = ({ companyId, candidateId, search, clientId, subclientId, status, dateFrom, dateTo, sortBy, sortOrder }) =>
  prisma.candidate.findMany({
    where: {
      ...buildListWhere({ companyId, search, clientId, subclientId, status, dateFrom, dateTo }),
      ...(candidateId ? { id: candidateId } : {}),
    },
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      candidateCode: true,
      fullName: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      fatherName: true,
      motherName: true,
      aadhaarNumber: true,
      panNumber: true,
      uanNumber: true,
      passportNumber: true,
      drivingLicenseNumber: true,
      voterIdNumber: true,
      highestQualification: true,
      courseName: true,
      institutionName: true,
      universityName: true,
      yearOfPassing: true,
      gradeOrPercentage: true,
      employeeId: true,
      employeeDesignation: true,
      employeeDepartment: true,
      employmentType: true,
      joiningDate: true,
      workLocation: true,
      currentEmployer: true,
      employmentHistory: true,
      currentAddress: true,
      permanentAddress: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { bgvCases: true } },
      client: { select: { name: true } },
      subclient: { select: { name: true } },
      documents: {
        select: {
          documentType: true,
          documentNumber: true,
          fileName: true,
          verificationStatus: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: 'asc' },
      },
      consents: {
        where: { consentType: 'BGV_CONSENT' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { consentGiven: true, consentedAt: true, revokedAt: true },
      },
    },
  });

module.exports = { create, findById, update, softDelete, list, listForExport };
