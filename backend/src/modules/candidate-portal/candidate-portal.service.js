'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { prisma } = require('../../common/prisma');
const config = require('../../config');
const { sendMail, buildCandidatePortalEmail } = require('../../utils/mailer');
const { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } = require('../../utils/errors');
const { IDENTITY_FIELDS, EMPLOYMENT_DOCUMENT_TYPES, ADDRESS_DOCUMENT_TYPES, normalizeConfig, normalizeIdentityValue, validateIdentityValues } = require('../client/candidate-intake-config');
const { findTemplatePath } = require('../client/candidate-form-storage');
const { normalizeCandidateName, hasCandidateName } = require('../../utils/candidate-name');

const MAX_INVITATION_DAYS = 30;
const portalTokenKey = crypto.createHash('sha256').update(`candidate-portal:${config.jwt.accessSecret}`).digest();
const DOCUMENT_TYPES = new Set(['PAN', 'UAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'FORM_16', 'RELIEVING_LETTER', 'OFFER_LETTER', 'APPOINTMENT_LETTER', 'INCREMENT_LETTER', 'PROMOTION_LETTER', 'BANK_STATEMENT', 'PF_STATEMENT', 'EMPLOYMENT_CONTRACT', ...ADDRESS_DOCUMENT_TYPES, 'OTHER']);
const CHECKS_FOR_FORM_CATEGORY = {
  IDENTITY: new Set(['IDENTITY', 'IDENTITY_VERIFICATION', 'PAN', 'AADHAAR', 'UAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'DOCUMENT', 'DOCUMENT_FORGERY']),
  EDUCATION: new Set(['EDUCATION', 'EDUCATION_VERIFICATION']),
  EMPLOYMENT: new Set(['EMPLOYMENT', 'EMPLOYMENT_VERIFICATION', 'UAN']),
  POLICE_VERIFICATION: new Set(['POLICE', 'POLICE_VERIFICATION', 'POLICE_RECORD', 'COURT']),
};
const STANDARD_FORM_CHECKS = new Set(Object.values(CHECKS_FOR_FORM_CATEGORY).flatMap((types) => [...types]));

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createToken = () => crypto.randomBytes(32).toString('hex');
const rejectDocumentUpload = async (file, message) => {
  if (file?.path) await fs.unlink(file.path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  throw new BadRequestError(message);
};
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
      client: { select: { id: true, name: true, candidateFormConfig: true } },
      documents: true,
      bgvCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { checks: { include: { documents: true } }, consents: true },
      },
    },
  },
};

const isCustomFormEnabled = (form, candidateFormConfig, activeCase) => {
  if (!form.enabled) return false;
  if (form.category === 'EDUCATION' && !candidateFormConfig.sections.education.enabled) return false;
  if (form.category === 'EMPLOYMENT' && !candidateFormConfig.sections.employment.enabled) return false;
  if (form.category === 'POLICE_VERIFICATION' && !candidateFormConfig.sections.policeVerification.enabled) return false;
  if (form.category === 'IDENTITY' && !IDENTITY_FIELDS.some(({ key }) => candidateFormConfig[key].enabled)) return false;
  const selectedChecks = activeCase?.checks?.map((check) => check.type) || [];
  if (form.category === 'OTHER_CHECKS') {
    return selectedChecks.length === 0 || selectedChecks.some((type) => !STANDARD_FORM_CHECKS.has(type));
  }
  const categoryChecks = CHECKS_FOR_FORM_CATEGORY[form.category];
  if (selectedChecks.length > 0 && categoryChecks && !selectedChecks.some((check) => categoryChecks.has(check))) return false;
  return true;
};

const findInvitation = async (token) => {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) throw new UnauthorizedError('This portal link is invalid.');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: invitationInclude });
  if (!invitation || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.candidate.isDeleted) {
    throw new UnauthorizedError('This portal link has expired or is no longer active.');
  }
  return invitation;
};

const isPortalLocked = (candidate) => {
  const activeCase = candidate.bgvCases?.[0];
  const consentGiven = Boolean(activeCase?.consents?.some((consent) => consent.consentType === 'BGV_CONSENT' && consent.consentGiven));
  return consentGiven
    || ['COMPLETED', 'CANCELLED'].includes(activeCase?.status)
    || (!activeCase && candidate.status === 'VERIFICATION_IN_PROGRESS');
};

const pendingFor = (candidate) => {
  const activeCase = candidate.bgvCases[0];
  const candidateFormConfig = normalizeConfig(candidate.client?.candidateFormConfig);
  const existingDocuments = [
    ...(candidate.documents || []),
    ...(activeCase?.checks || []).flatMap((check) => check.documents || []),
  ];
  const consentComplete = Boolean(activeCase?.consents?.some((consent) => consent.consentType === 'BGV_CONSENT' && consent.consentGiven && !consent.revokedAt));
  const formLocked = isPortalLocked(candidate);
  const pending = [];
  for (const check of activeCase?.checks || []) {
    if (DOCUMENT_TYPES.has(check.type)) {
      const uploaded = [...(candidate.documents || []), ...(check.documents || [])];
      if (!uploaded.some((document) => document.documentType === check.type)) {
        pending.push({
          key: `document-${check.id}`,
          label: `Upload documents for ${check.type.replaceAll('_', ' ').toLowerCase()}`,
          type: 'document',
          documentType: check.type,
          ...(['ADDRESS_PROOF', 'GPS_ADDRESS_PHOTO', 'ELECTRICITY_BILL', 'UTILITY_BILL', 'RENT_AGREEMENT'].includes(check.type) ? { category: 'ADDRESS' } : {}),
        });
      }
    }
  }

  for (const field of IDENTITY_FIELDS) {
    const config = candidateFormConfig[field.key];
    if (config.required && !candidate[field.key]) {
      pending.push({ key: `field-${field.key}`, label: `Provide your ${field.label} number`, type: 'profile' });
    }
    if (config.documentRequired && !existingDocuments.some((document) => document.documentType === field.documentType)
      && !pending.some((item) => item.documentType === field.documentType)) {
      pending.push({ key: `document-${field.documentType}`, label: `Upload your ${field.label} document`, type: 'document', documentType: field.documentType });
    }
  }

  const addressConfig = candidateFormConfig.address;
  if (candidateFormConfig.sections.address.enabled) {
    for (const field of [
      { key: 'currentAddress', label: 'current address', required: addressConfig.currentAddressRequired },
      { key: 'permanentAddress', label: 'permanent address', required: addressConfig.permanentAddressRequired },
    ]) {
      if (field.required && !candidate[field.key]) {
        pending.push({ key: `field-${field.key}`, label: `Provide your ${field.label}`, type: 'profile', category: 'ADDRESS' });
      }
    }
    for (const document of addressConfig.documents) {
      if (!document.enabled || !document.required) continue;
      if (!existingDocuments.some((item) => item.documentType === document.type)) {
        pending.push({
          key: `address-document-${document.type}`,
          label: `Upload your ${document.type.replaceAll('_', ' ').toLowerCase()}`,
          type: 'document',
          documentType: document.type,
          category: 'ADDRESS',
        });
      }
    }
  }

  const selectedChecks = activeCase?.checks?.map((check) => check.type) || [];
  const employmentRequested = !activeCase || selectedChecks.length === 0
    || selectedChecks.some((type) => CHECKS_FOR_FORM_CATEGORY.EMPLOYMENT.has(type));
  if (candidateFormConfig.sections.employment.enabled && employmentRequested) {
    for (const document of candidateFormConfig.employmentDocuments) {
      if (!document.enabled || !document.required) continue;
      if (!existingDocuments.some((item) => item.documentType === document.type)) {
        pending.push({
          key: `employment-document-${document.type}`,
          label: `Upload your ${document.type.replaceAll('_', ' ').toLowerCase()}`,
          type: 'document',
          documentType: document.type,
          category: 'EMPLOYMENT',
        });
      }
    }
  }

  for (const form of candidateFormConfig.customForms) {
    if (!isCustomFormEnabled(form, candidateFormConfig, activeCase) || !form.required) continue;
    const uploaded = existingDocuments.some((document) => document.documentNumber === `CUSTOM_FORM:${form.id}`);
    if (!uploaded) {
      pending.push({
        key: `custom-form-${form.id}`,
        label: `Complete and upload ${form.name}`,
        type: 'document',
        customFormId: form.id,
        category: form.category,
      });
    }
  }

  const addressComplete = !candidateFormConfig.sections.address.enabled
    || ((!candidateFormConfig.address.currentAddressRequired || Boolean(candidate.currentAddress))
      && (!candidateFormConfig.address.permanentAddressRequired || Boolean(candidate.permanentAddress)));
  const profileComplete = Boolean(candidate.firstName && candidate.lastName && candidate.email && candidate.phone && candidate.dateOfBirth && addressComplete)
    && IDENTITY_FIELDS.every((field) => !candidateFormConfig[field.key].required || Boolean(candidate[field.key]));
  if (!profileComplete) pending.push({ key: 'profile', label: 'Review and complete your details', type: 'profile' });
  const consentReady = Boolean(
    activeCase
    && !['COMPLETED', 'CANCELLED'].includes(activeCase.status)
    && pending.length === 0,
  );
  if (activeCase && !consentComplete) pending.push({ key: 'consent', label: 'Give background verification consent', type: 'consent' });
  return { activeCase, pending, consentComplete, consentReady, formLocked, profileComplete };
};

const toDto = (invitation) => {
  const candidate = invitation.candidate;
  const candidateFormConfig = normalizeConfig(candidate.client?.candidateFormConfig);
  const { activeCase, pending, consentComplete, consentReady, formLocked, profileComplete } = pendingFor(candidate);
  return {
    candidate: {
      id: candidate.id,
      status: candidate.status,
      fullName: candidate.fullName,
      firstName: candidate.firstName,
      middleName: candidate.middleName,
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
    client: candidate.client ? { name: candidate.client.name } : null,
    candidateFormConfig,
    case: activeCase ? { id: activeCase.id, caseNumber: activeCase.caseNumber, status: activeCase.status, checks: activeCase.checks.map((check) => check.type) } : null,
    documents: (candidate.documents || []).map((document) => ({ id: document.id, documentType: document.documentType, documentNumber: document.documentNumber, fileName: document.fileName, fileUrl: document.fileUrl, verificationStatus: document.verificationStatus, uploadedAt: document.uploadedAt })),
    progress: { pending, pendingCount: pending.length, consentComplete, consentReady, formLocked, profileComplete },
    invitation: { expiresAt: invitation.expiresAt },
  };
};

const sendInvitationEmail = async ({ candidate, token, reminder, pendingCount }) => {
  if (!candidate.email) return false;
  const portalUrl = `${config.frontendUrl.replace(/\/$/, '')}/candidate-portal/${token}`;
  const mail = buildCandidatePortalEmail({ candidateName: candidate.fullName || [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' '), companyName: candidate.company.name, clientName: candidate.client?.name, portalUrl, reminder, pendingCount });
  try {
    await sendMail({ to: candidate.email, ...mail });
    return true;
  } catch (_error) {
    return false;
  }
};

const issue = async ({ candidateId, companyId, expiresInDays }) => {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, ...(companyId ? { companyId } : {}), isDeleted: false }, include: { company: true, client: { select: { id: true, name: true, candidateFormConfig: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  if (!candidate.email) throw new BadRequestError('Candidate email is required before sending a portal link.');
  const clientExpiryDays = normalizeConfig(candidate.client?.candidateFormConfig).invitationExpiryDays;
  const days = Number(expiresInDays ?? clientExpiryDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_INVITATION_DAYS) throw new BadRequestError(`Link expiry must be between 1 and ${MAX_INVITATION_DAYS} days.`);

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
  if (emailSent && invitation.candidate.status === 'PENDING') {
    await prisma.candidate.update({ where: { id: candidateId }, data: { status: 'INVITED' } });
  }
  return { ...toStaffStatus({ ...invitation, lastSentAt }), emailSent, status: toDto(invitation) };
};

const remind = async ({ candidateId, companyId, clientId }) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId, ...(clientId ? { clientId } : {}), isDeleted: false },
    include: { company: true, client: { select: { id: true, name: true, candidateFormConfig: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } },
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

const getStaffStatus = async ({ candidateId, companyId, clientId }) => {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, companyId, ...(clientId ? { clientId } : {}), isDeleted: false }, select: { id: true } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { candidateId }, select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true, encryptedToken: true } });
  return toStaffStatus(invitation);
};

const lock = async ({ candidateId, companyId, clientId, locked }) => {
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, companyId, ...(clientId ? { clientId } : {}), isDeleted: false }, select: { id: true } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  const invitation = await prisma.candidatePortalInvitation.findUnique({ where: { candidateId } });
  if (!invitation) throw new NotFoundError('Candidate portal has not been activated.');
  const updated = await prisma.candidatePortalInvitation.update({ where: { candidateId }, data: { revokedAt: locked ? new Date() : null }, select: { activatedAt: true, lastSentAt: true, expiresAt: true, revokedAt: true, reminderCount: true, lastRemindedAt: true, encryptedToken: true } });
  return toStaffStatus(updated);
};

const getPortal = async (token) => toDto(await findInvitation(token));
const getCandidateFormTemplate = async (token, formId) => {
  const invitation = await findInvitation(token);
  if (!/^[0-9a-f-]{36}$/i.test(formId || '')) throw new NotFoundError('Form template is not available.');
  const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
  const form = candidateFormConfig.customForms.find((item) =>
    item.id === formId && isCustomFormEnabled(item, candidateFormConfig, invitation.candidate.bgvCases[0]),
  );
  if (!form) throw new NotFoundError('Form template is not available.');
  const legacyFileUrl = invitation.candidate.client.candidateFormConfig?.customForms?.find((item) => item.id === formId)?.fileUrl;
  const filePath = await findTemplatePath(invitation.candidate.client.id, formId, legacyFileUrl, form.fileName);
  if (!filePath) throw new NotFoundError('Form template is not available.');
  return { filePath, fileName: form.fileName };
};
const assertPortalEditable = async (token) => {
  const invitation = await findInvitation(token);
  if (isPortalLocked(invitation.candidate)) {
    throw new ConflictError('This candidate form is locked after consent or case completion.');
  }
};

const updateProfile = async (token, payload) => {
  const invitation = await findInvitation(token);
  if (isPortalLocked(invitation.candidate)) {
    throw new ConflictError('Candidate details cannot be changed after consent or case completion.');
  }
  const allowed = ['fullName', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'fatherName', 'motherName', 'aadhaarNumber', 'panNumber', 'uanNumber', 'passportNumber', 'drivingLicenseNumber', 'voterIdNumber', 'highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage', 'employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer', 'currentAddress', 'permanentAddress'];
  const data = {};
  for (const field of allowed) {
    if (payload[field] !== undefined) data[field] = field === 'email' ? (payload[field]?.trim().toLowerCase() || null) : payload[field];
  }
  if (hasCandidateName(data)) Object.assign(data, normalizeCandidateName(data, invitation.candidate));
  const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
  const addressConfig = candidateFormConfig.address;
  if (!candidateFormConfig.sections.address.enabled
    && (data.currentAddress !== undefined || data.permanentAddress !== undefined)) {
    throw new BadRequestError('Address details are not enabled for this client’s candidate form.');
  }
  if (data.currentAddress !== undefined && !addressConfig.currentAddressEnabled) {
    throw new BadRequestError('Current address is not enabled for this client’s candidate form.');
  }
  if (data.permanentAddress !== undefined && !addressConfig.permanentAddressEnabled) {
    throw new BadRequestError('Permanent address is not enabled for this client’s candidate form.');
  }
  for (const field of IDENTITY_FIELDS) {
    if (data[field.key] !== undefined && !candidateFormConfig[field.key].enabled) {
      throw new BadRequestError(`${field.label} is not enabled for this client’s candidate form.`);
    }
  }
  const disabledSectionFields = {
    family: ['fatherName', 'motherName'],
    education: ['highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage'],
    employment: ['employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer'],
  };
  for (const [section, fields] of Object.entries(disabledSectionFields)) {
    if (!candidateFormConfig.sections[section].enabled && fields.some((field) => data[field] !== undefined)) {
      throw new BadRequestError(`${section} details are not enabled for this client’s candidate form.`);
    }
  }
  validateIdentityValues(data);
  for (const field of IDENTITY_FIELDS) {
    if (data[field.key] !== undefined) data[field.key] = normalizeIdentityValue(field.key, data[field.key]) || null;
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
  const candidateAfterUpdate = { ...invitation.candidate, ...data };
  const { profileComplete } = pendingFor(candidateAfterUpdate);
  const nextStatus = ['PENDING', 'INVITED', 'IN_PROGRESS', 'COMPLETED'].includes(invitation.candidate.status)
    ? profileComplete ? 'COMPLETED' : 'IN_PROGRESS'
    : invitation.candidate.status;
  await prisma.candidate.update({ where: { id: invitation.candidateId }, data: { ...data, status: nextStatus } });
  return getPortal(token);
};

const recordConsent = async (token, payload, request) => {
  const invitation = await findInvitation(token);
  const activeCase = invitation.candidate.bgvCases[0];
  if (!activeCase) throw new BadRequestError('There is no active verification case for this candidate.');
  if (['COMPLETED', 'CANCELLED'].includes(activeCase.status)) throw new ConflictError('This candidate form is locked because the BGV case is finalized.');
  if (payload.consentGiven !== true) throw new BadRequestError('Consent must be explicitly accepted.');
  if (!pendingFor(invitation.candidate).consentReady) {
    throw new BadRequestError('Complete all required candidate details and documents before giving consent.');
  }
  const existing = activeCase.consents.find((consent) => consent.consentType === 'BGV_CONSENT');
  if (existing?.consentGiven && !existing.revokedAt) {
    throw new ConflictError('Consent has already been recorded.');
  }
  const data = { consentGiven: true, consentVersion: payload.consentVersion || '1.0', consentText: payload.consentText || 'I consent to the background verification checks requested for my application.', ipAddress: request.ip, userAgent: request.get('user-agent'), consentedAt: new Date(), revokedAt: null };
  if (existing) await prisma.candidateConsent.update({ where: { id: existing.id }, data });
  else await prisma.candidateConsent.create({ data: { candidateId: invitation.candidateId, caseId: activeCase.id, consentType: 'BGV_CONSENT', ...data } });
  return getPortal(token);
};

const addDocument = async (token, file, documentType, documentNumber, customFormId, documentCategory) => {
  const invitation = await findInvitation(token);
  if (isPortalLocked(invitation.candidate)) {
    if (file?.path) await fs.unlink(file.path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    throw new ConflictError('This candidate form is locked after consent or case completion.');
  }
  if (!file) throw new BadRequestError('Choose a document to upload.');
  if (!DOCUMENT_TYPES.has(documentType)) await rejectDocumentUpload(file, 'Document type is invalid.');
  if (documentCategory !== undefined && !['EMPLOYMENT', 'ADDRESS'].includes(documentCategory)) {
    await rejectDocumentUpload(file, 'Document category is invalid.');
  }
  if (documentCategory === 'ADDRESS') {
    const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
    const addressDocument = candidateFormConfig.address.documents.find((item) => item.type === documentType && item.enabled);
    const requestedByCase = invitation.candidate.bgvCases[0]?.checks.some((check) => check.type === documentType);
    if ((!candidateFormConfig.sections.address.enabled || !addressDocument) && !requestedByCase) {
      await rejectDocumentUpload(file, 'This address document type is not enabled for this client.');
    }
  } else if (documentCategory === 'EMPLOYMENT') {
    const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
    const employmentDocument = candidateFormConfig.employmentDocuments.find((item) => item.type === documentType && item.enabled);
    if (!candidateFormConfig.sections.employment.enabled || !employmentDocument) {
      await rejectDocumentUpload(file, 'This employment document type is not enabled for this client.');
    }
  } else if (ADDRESS_DOCUMENT_TYPES.includes(documentType)) {
    const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
    const addressDocument = candidateFormConfig.address.documents.find((item) => item.type === documentType && item.enabled);
    const requestedByCase = invitation.candidate.bgvCases[0]?.checks.some((check) => check.type === documentType);
    if ((!candidateFormConfig.sections.address.enabled || !addressDocument) && !requestedByCase) {
      await rejectDocumentUpload(file, 'This address document type is not enabled for this client.');
    }
  } else if (EMPLOYMENT_DOCUMENT_TYPES.includes(documentType) && documentType !== 'OTHER') {
    const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
    if (!candidateFormConfig.employmentDocuments.some((item) => item.type === documentType && item.enabled)) {
      await rejectDocumentUpload(file, 'This employment document type is not enabled for this client.');
    }
  }
  let storedDocumentNumber = documentNumber?.trim() || null;
  let customForm = null;
  if (customFormId) {
    const candidateFormConfig = normalizeConfig(invitation.candidate.client?.candidateFormConfig);
    customForm = candidateFormConfig.customForms
      .find((item) => item.id === customFormId && isCustomFormEnabled(item, candidateFormConfig, invitation.candidate.bgvCases[0]));
    if (!customForm) await rejectDocumentUpload(file, 'This form is not enabled for this client.');
    documentType = 'OTHER';
    storedDocumentNumber = `CUSTOM_FORM:${customForm.id}`;
  }
  const extension = path.extname(file.originalname).toLowerCase();
  if (['.doc', '.docx'].includes(extension) && !customForm) {
    await rejectDocumentUpload(file, 'Word documents can only be uploaded as completed BGV/PCC forms.');
  }
  const identityField = IDENTITY_FIELDS.find((field) => field.documentType === documentType);
  if (identityField && documentCategory !== 'ADDRESS' && !ADDRESS_DOCUMENT_TYPES.includes(documentType)
    && !normalizeConfig(invitation.candidate.client?.candidateFormConfig)[identityField.key].enabled) {
    await rejectDocumentUpload(file, `${identityField.label} documents are not enabled for this client’s candidate form.`);
  }
  const signature = await fs.readFile(file.path);
  const mimeType = file.mimetype.toLowerCase();
  const genericMime = mimeType === 'application/octet-stream';
  const validSignature = extension === '.pdf'
    ? signature.subarray(0, 1024).includes(Buffer.from('%PDF-'))
      && (mimeType === 'application/pdf' || genericMime)
    : extension === '.doc'
      ? signature.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
        && (['application/msword', 'application/vnd.ms-word'].includes(mimeType) || genericMime)
      : extension === '.docx'
        ? signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
          && (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || genericMime)
        : ['.jpg', '.jpeg'].includes(extension)
          ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
            && (mimeType === 'image/jpeg' || genericMime)
          : extension === '.png'
            ? signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
              && (mimeType === 'image/png' || genericMime)
            : false;
  if (!validSignature || (documentType === 'GPS_ADDRESS_PHOTO' && !['image/jpeg', 'image/png'].includes(file.mimetype))) {
    await rejectDocumentUpload(file, documentType === 'GPS_ADDRESS_PHOTO'
      ? 'GPS address photos must be valid JPG or PNG images.'
      : 'The uploaded file content does not match its file type.');
  }
  const fileName = path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'document';
  const document = await prisma.candidateDocument.create({ data: { candidateId: invitation.candidateId, documentType, documentNumber: storedDocumentNumber, fileName, fileUrl: `/uploads/candidate-documents/portal/${token}/${path.basename(file.filename)}`, mimeType: file.mimetype, fileSize: file.size } });
  return { document, status: await getPortal(token) };
};

module.exports = { issue, remind, getPortal, getCandidateFormTemplate, getStaffStatus, lock, updateProfile, recordConsent, assertPortalEditable, addDocument };
