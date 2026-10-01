'use strict';

const crypto = require('crypto');
const path = require('path');
const { prisma } = require('../../common/prisma');
const config = require('../../config');
const { sendMail, buildCandidatePortalEmail } = require('../../utils/mailer');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../../utils/errors');

const MAX_INVITATION_DAYS = 30;
const portalTokenKey = crypto.createHash('sha256').update(`candidate-portal:${config.jwt.accessSecret}`).digest();
const DOCUMENT_TYPES = new Set(['PAN', 'UAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'FORM_16', 'RELIEVING_LETTER', 'OFFER_LETTER', 'APPOINTMENT_LETTER', 'INCREMENT_LETTER', 'PROMOTION_LETTER', 'BANK_STATEMENT', 'PF_STATEMENT', 'EMPLOYMENT_CONTRACT', 'ADDRESS_PROOF', 'OTHER']);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createToken = () => crypto.randomBytes(32).toString('hex');
const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', portalTokenKey, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};
const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  try {
    const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', portalTokenKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};
const portalUrlFor = (token) => `${config.frontendUrl.replace(/\/$/, '')}/candidate-portal/${token}`;
const toStaffStatus = (invitation) => {
  if (!invitation) return null;
  const token = decryptToken(invitation.encryptedToken);
  return {
    activatedAt: invitation.activatedAt,
    lastSentAt: invitation.lastSentAt,
    expiresAt: invitation.expiresAt,
    revokedAt: invitation.revokedAt,
    reminderCount: invitation.reminderCount,
    lastRemindedAt: invitation.lastRemindedAt,
    url: token ? portalUrlFor(token) : null,
  };
};

const invitationInclude = {
  candidate: {
    include: {
      company: { select: { name: true, primaryColor: true, logoUrl: true } },
      client: { select: { name: true } },
      documents: true,
      bgvCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { checks: { include: { documents: true } }, consents: true },
      },
    },
  },
};

const findInvitation = async (token) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) throw new UnauthorizedError('This portal link is invalid.');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: invitationInclude });
  if (!invitation || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.candidate.isDeleted) {
    throw new UnauthorizedError('This portal link has expired or is no longer active.');
  }
  return invitation;
};

const pendingFor = (candidate) => {
  const activeCase = candidate.bgvCases[0];
  const consentComplete = Boolean(activeCase?.consents?.some((consent) => consent.consentType === 'BGV_CONSENT' && consent.consentGiven && !consent.revokedAt));
  const pending = [];
  if (activeCase && !consentComplete) pending.push({ key: 'consent', label: 'Give background verification consent', type: 'consent' });

  for (const check of activeCase?.checks || []) {
    if (DOCUMENT_TYPES.has(check.type)) {
      const uploaded = [...(candidate.documents || []), ...(check.documents || [])];
      if (!uploaded.some((document) => document.documentType === check.type)) {
        pending.push({ key: `document-${check.id}`, label: `Upload documents for ${check.type.replaceAll('_', ' ').toLowerCase()}`, type: 'document', documentType: check.type });
      }
    }
  }

  const profileComplete = Boolean(candidate.firstName && candidate.lastName && candidate.email && candidate.phone && candidate.dateOfBirth && candidate.currentAddress);
  if (!profileComplete) pending.push({ key: 'profile', label: 'Review and complete your details', type: 'profile' });
  return { activeCase, pending, consentComplete, profileComplete };
};

const toDto = (invitation) => {
  const candidate = invitation.candidate;
  const { activeCase, pending, consentComplete, profileComplete } = pendingFor(candidate);
  return {
    candidate: {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      dateOfBirth: candidate.dateOfBirth,
      gender: candidate.gender,
      fatherName: candidate.fatherName,
      motherName: candidate.motherName,
      aadhaarNumber: candidate.aadhaarNumber,
      panNumber: candidate.panNumber,
      uanNumber: candidate.uanNumber,
      passportNumber: candidate.passportNumber,
      drivingLicenseNumber: candidate.drivingLicenseNumber,
      voterIdNumber: candidate.voterIdNumber,
      highestQualification: candidate.highestQualification,
      courseName: candidate.courseName,
      institutionName: candidate.institutionName,
      universityName: candidate.universityName,
      yearOfPassing: candidate.yearOfPassing,
      gradeOrPercentage: candidate.gradeOrPercentage,
      employeeId: candidate.employeeId,
      employeeDesignation: candidate.employeeDesignation,
      employeeDepartment: candidate.employeeDepartment,
      employmentType: candidate.employmentType,
      joiningDate: candidate.joiningDate,
      workLocation: candidate.workLocation,
      currentEmployer: candidate.currentEmployer,
      currentAddress: candidate.currentAddress,
      permanentAddress: candidate.permanentAddress,
    },
    company: candidate.company,
    client: candidate.client,
    case: activeCase ? { id: activeCase.id, caseNumber: activeCase.caseNumber, status: activeCase.status } : null,
    documents: (candidate.documents || []).map((document) => ({ id: document.id, documentType: document.documentType, documentNumber: document.documentNumber, fileName: document.fileName, fileUrl: document.fileUrl, verificationStatus: document.verificationStatus, uploadedAt: document.uploadedAt })),
    progress: { pending, pendingCount: pending.length, consentComplete, profileComplete },
    invitation: { expiresAt: invitation.expiresAt },
  };
};

const sendInvitationEmail = async ({ candidate, token, reminder, pendingCount }) => {
  if (!candidate.email) return false;
  const portalUrl = `${config.frontendUrl.replace(/\/$/, '')}/candidate-portal/${token}`;
  const mail = buildCandidatePortalEmail({ candidateName: `${candidate.firstName} ${candidate.lastName}`, companyName: candidate.company.name, clientName: candidate.client?.name, portalUrl, reminder, pendingCount });
  try {
    await sendMail({ to: candidate.email, ...mail });
    return true;
  } catch (_error) {
    return false;
  }
};

const issue = async ({ candidateId, companyId, expiresInDays = MAX_INVITATION_DAYS }) => {
  const days = Number(expiresInDays ?? MAX_INVITATION_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > MAX_INVITATION_DAYS) throw new BadRequestError(`Link expiry must be between 1 and ${MAX_INVITATION_DAYS} days.`);
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, ...(companyId ? { companyId } : {}), isDeleted: false }, include: { company: true, client: { select: { name: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  if (!candidate.email) throw new BadRequestError('Candidate email is required before sending a portal link.');

  const token = createToken();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const invitation = await prisma.candidatePortalInvitation.upsert({
    where: { candidateId },
    create: { candidateId, tokenHash: hashToken(token), encryptedToken: encryptToken(token), expiresAt },
    update: { tokenHash: hashToken(token), encryptedToken: encryptToken(token), expiresAt, revokedAt: null },
    include: invitationInclude,
  });
  const status = pendingFor(invitation.candidate);
  const emailSent = await sendInvitationEmail({ candidate: invitation.candidate, token, reminder: false, pendingCount: status.pending.length });
  const lastSentAt = emailSent ? new Date() : invitation.lastSentAt;
  if (emailSent) await prisma.candidatePortalInvitation.update({ where: { candidateId }, data: { lastSentAt } });
  return { ...toStaffStatus({ ...invitation, lastSentAt }), emailSent, status: toDto(invitation) };
};

const remind = async ({ candidateId, companyId }) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId, isDeleted: false },
    include: { company: true, client: { select: { name: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');
  if (!candidate.email) throw new BadRequestError('Candidate email is required before sending a reminder.');

  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { candidateId } });
  if (!invitation) throw new NotFoundError('Candidate portal has not been activated.');
  if (invitation.revokedAt || invitation.expiresAt <= new Date()) {
    throw new BadRequestError('This portal link is no longer active. Resend the invitation to create a new link.');
  }
  const token = decryptToken(invitation.encryptedToken);
  if (!token) throw new BadRequestError('This link cannot be resent because it predates secure link storage. Extend the link to create a new one first.');

  const status = pendingFor(candidate);
  const emailSent = await sendInvitationEmail({ candidate, token, reminder: true, pendingCount: status.pending.length });
  let updatedInvitation = invitation;
  if (emailSent) {
    updatedInvitation = await prisma.candidatePortalInvitation.update({
      where: { candidateId },
      data: { lastSentAt: new Date(), lastRemindedAt: new Date(), reminderCount: { increment: 1 } },
    });
  }
  return { ...toStaffStatus(updatedInvitation), emailSent };
};

const getStaffStatus = async ({ candidateId, companyId }) => {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, companyId, isDeleted: false }, select: { id: true } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { candidateId }, select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true, encryptedToken: true } });
  return toStaffStatus(invitation);
};

const lock = async ({ candidateId, companyId, locked }) => {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, companyId, isDeleted: false }, select: { id: true } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { candidateId } });
  if (!invitation) throw new NotFoundError('Candidate portal has not been activated.');
  const updated = await prisma.candidatePortalInvitation.update({ where: { candidateId }, data: { revokedAt: locked ? new Date() : null }, select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true, encryptedToken: true } });
  return toStaffStatus(updated);
};

const getPortal = async (token) => toDto(await findInvitation(token));

const updateProfile = async (token, payload) => {
  const invitation = await findInvitation(token);
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'fatherName', 'motherName', 'aadhaarNumber', 'panNumber', 'uanNumber', 'passportNumber', 'drivingLicenseNumber', 'voterIdNumber', 'highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage', 'employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer', 'currentAddress', 'permanentAddress'];
  const data = {};
  for (const field of allowed) {
    if (payload[field] !== undefined) data[field] = field === 'email' ? (payload[field]?.trim().toLowerCase() || null) : payload[field];
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new BadRequestError('Email address must be valid.');
  for (const dateField of ['dateOfBirth', 'joiningDate']) {
    if (data[dateField] === '') {
      data[dateField] = null;
    } else if (data[dateField]) {
      data[dateField] = new Date(`${String(data[dateField]).slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(data[dateField].getTime())) throw new BadRequestError(`${dateField} must be a valid date.`);
    }
  }
  if (!Object.keys(data).length) throw new BadRequestError('Provide at least one detail to update.');
  await prisma.candidate.update({ where: { id: invitation.candidateId }, data });
  return getPortal(token);
};

const recordConsent = async (token, payload, request) => {
  const invitation = await findInvitation(token);
  const activeCase = invitation.candidate.bgvCases[0];
  if (!activeCase) throw new BadRequestError('There is no active verification case for this candidate.');
  if (payload.consentGiven !== true) throw new BadRequestError('Consent must be explicitly accepted.');
  const existing = activeCase.consents.find((consent) => consent.consentType === 'BGV_CONSENT');
  const data = { consentGiven: true, consentVersion: payload.consentVersion || '1.0', consentText: payload.consentText || 'I consent to the background verification checks requested for my application.', ipAddress: request.ip, userAgent: request.get('user-agent'), consentedAt: new Date(), revokedAt: null };
  if (existing) await prisma.candidateConsent.update({ where: { id: existing.id }, data });
  else await prisma.candidateConsent.create({ data: { candidateId: invitation.candidateId, caseId: activeCase.id, consentType: 'BGV_CONSENT', ...data } });
  return getPortal(token);
};

const addDocument = async (token, file, documentType, documentNumber) => {
  const invitation = await findInvitation(token);
  if (!file) throw new BadRequestError('Choose a document to upload.');
  if (!DOCUMENT_TYPES.has(documentType)) throw new BadRequestError('Document type is invalid.');
  const document = await prisma.candidateDocument.create({ data: { candidateId: invitation.candidateId, documentType, documentNumber: documentNumber?.trim() || null, fileName: file.originalname, fileUrl: `/uploads/candidate-documents/portal/${token}/${path.basename(file.filename)}`, mimeType: file.mimetype, fileSize: file.size } });
  return { document, status: await getPortal(token) };
};

module.exports = { issue, remind, getPortal, getStaffStatus, lock, updateProfile, recordConsent, addDocument };
