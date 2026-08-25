'use strict';

const { prisma } = require('../../common/prisma');

const findCase = (caseId, companyId) => prisma.bGVCase.findFirst({ where: { id: caseId, companyId }, select: { id: true } });
const findById = (id, companyId) => prisma.verificationCheck.findFirst({ where: { id, case: { companyId } }, include: { case: { select: { id: true, caseNumber: true, companyId: true, candidateId: true } }, documents: true } });
const create = (data) => prisma.verificationCheck.create({ data });
const update = (id, data) => prisma.verificationCheck.update({ where: { id }, data });
const list = (companyId, { caseId, type, status } = {}) => prisma.verificationCheck.findMany({
	where: {
		case: { companyId, ...(caseId ? { id: caseId } : {}) },
		...(type ? { type } : {}),
		...(status ? { status } : {}),
	},
	include: { documents: true },
	orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
});
const event = (data) => prisma.verificationEvent.create({ data });
const addDocument = (data) => prisma.candidateDocument.create({ data });
const deleteDocument = (id, verificationId) => prisma.candidateDocument.deleteMany({ where: { id, verificationId } });

module.exports = { findCase, findById, create, update, list, event, addDocument, deleteDocument };
