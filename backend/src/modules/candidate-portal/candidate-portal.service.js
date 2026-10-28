'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { prisma } = require('../../common/prisma');
const config = require('../../config');
const { sendMail, buildCandidatePortalEmail } = require('../../utils/mailer');
const { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } = require('../../utils/errors');
const { parseDateValue } = require('../../utils/date');
const { IDENTITY_FIELDS, EMPLOYMENT_DOCUMENT_TYPES, ADDRESS_DOCUMENT_TYPES, normalizeConfig, normalizeIdentityValue, validateIdentityValues } = require('../client/candidate-intake-config');
const { findTemplatePath } = require('../client/candidate-form-storage');

const MAX_INVITATION_DAYS = 30;
const CURRENT_EMPLOYMENT_RECORD_ID = 'employment-current';
const portalTokenKey = crypto.createHash('sha256').update(`candidate-portal:${config.jwt.accessSecret}`).digest();
const DOCUMENT_TYPES = new Set(['PAN', 'UAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 'FORM_16', 'RELIEVING_LETTER', 'OFFER_LETTER', 'APPOINTMENT_LETTER', 'INCREMENT_LETTER', 'PROMOTION_LETTER', 'BANK_STATEMENT', 'PF_STATEMENT', 'EMPLOYMENT_CONTRACT', ...ADDRESS_DOCUMENT_TYPES, 'OTHER']);
const EMPLOYMENT_HISTORY_FIELDS = {
  employerName: 255,
  employeeId: 100,
  designation: 150,
  department: 120,
  employmentType: 50,
  workLocation: 150,
  employerHrName: 255,
  employerHrPhone: 50,
};
const EDUCATION_HISTORY_FIELDS = {
  qualification: 120,
  courseName: 180,
  institutionName: 255,
  universityName: 255,
  yearOfPassing: 4,
  gradeOrPercentage: 50,
};
const hasEmploymentHistoryDetails = (record) => Object.entries(record || {}).some(([field, value]) =>
  field !== 'id' && field !== 'isCurrent' && value !== null && value !== undefined && value !== '',
);
const employmentHistoryRecordId = (record, index) =>
  typeof record.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(record.id)
    ? record.id
    : `employment-past-${index + 1}`;
const CHECKS_FOR_FORM_CATEGORY = {
  IDENTITY: new Set(['IDENTITY', 'IDENTITY_VERIFICATION', 'PAN', 'AADHAAR', 'UAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'DOCUMENT', 'DOCUMENT_FORGERY']),
  EDUCATION: new Set(['EDUCATION', 'EDUCATION_VERIFICATION']),
  EMPLOYMENT: new Set(['EMPLOYMENT', 'EMPLOYMENT_VERIFICATION', 'UAN']),
  POLICE_VERIFICATION: new Set(['POLICE', 'POLICE_VERIFICATION', 'POLICE_RECORD', 'COURT']),
};
const STANDARD_FORM_CHECKS = new Set([...Object.values(CHECKS_FOR_FORM_CATEGORY).flatMap((types) => [...types]), 'CIBIL']);

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
const consentTextFor = (companyName, clientName) =>
  `I voluntarily authorize ${companyName}${clientName ? `, on behalf of ${clientName},` : ''} to collect and verify the information and documents I provide and to conduct the background verification checks requested for my application. I confirm that the information I have provided is accurate to the best of my knowledge. I understand that the verification results may be shared with ${clientName || companyName} and authorized personnel for this verification purpose. I have read and agree to this consent statement.`;
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
      client: { select: { id: true, name: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } },
      subclient: { select: { id: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } },
      documents: true,
      consents: {
        where: { consentType: 'BGV_CONSENT' },
        orderBy: { createdAt: 'desc' },
      },
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
  const consents = [...(activeCase?.consents || []), ...(candidate.consents || [])];
  const consentGiven = consents.some((consent) =>
    consent.consentType === 'BGV_CONSENT' && consent.consentGiven && !consent.revokedAt,
  );
  const consentRevoked = consents.some((consent) =>
    consent.consentType === 'BGV_CONSENT' && consent.consentGiven && consent.revokedAt,
  );
  return consentGiven
    || ['COMPLETED', 'CANCELLED'].includes(activeCase?.status)
    || (!activeCase && candidate.status === 'VERIFICATION_IN_PROGRESS' && !consentRevoked);
};
const areUploadsLocked = (candidate) => {
  const activeCase = candidate.bgvCases?.[0];
  const consentRevoked = [...(activeCase?.consents || []), ...(candidate.consents || [])].some((consent) =>
    consent.consentType === 'BGV_CONSENT' && consent.consentGiven && consent.revokedAt,
  );
  return ['COMPLETED', 'CANCELLED'].includes(activeCase?.status)
    || (!activeCase && candidate.status === 'VERIFICATION_IN_PROGRESS' && !consentRevoked);
};

const getCandidateFormConfig = (candidate) =>
  normalizeConfig(candidate.subclient?.candidateFormConfig ?? candidate.client?.candidateFormConfig);

const pendingFor = (candidate) => {
  const activeCase = candidate.bgvCases[0];
  const candidateFormConfig = getCandidateFormConfig(candidate);
  const existingDocuments = [
    ...(candidate.documents || []),
    ...(activeCase?.checks || []).flatMap((check) => check.documents || []),
  ];
  const consentComplete = Boolean(
    [...(activeCase?.consents || []), ...(candidate.consents || [])]
      .some((consent) => consent.consentType === 'BGV_CONSENT' && consent.consentGiven && !consent.revokedAt),
  );
  const formLocked = isPortalLocked(candidate);
  const uploadsLocked = areUploadsLocked(candidate);
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
  const requiredFields = candidateFormConfig.fields;
  const requiredProfileFields = [
    ['phone', 'phone', 'mobile number', 'details'],
    ['dateOfBirth', 'dateOfBirth', 'date of birth', 'details'],
    ['gender', 'gender', 'gender', 'details'],
    ['candidateNotes', 'candidateNotes', 'notes for the verification team', 'details'],
    ['fatherName', 'fatherName', "father's name", 'family'],
    ['motherName', 'motherName', "mother's name", 'family'],
    ['maritalStatus', 'maritalStatus', 'marital status', 'family'],
    ['spouseName', 'spouseName', 'husband / spouse name', 'family'],
    ['childrenCount', 'childrenCount', 'number of children', 'family'],
  ];
  for (const [configKey, candidateKey, label, section] of requiredProfileFields) {
    if (!requiredFields[configKey]?.required || !candidateFormConfig.sections[section]?.enabled) continue;
    if (configKey === 'spouseName' && candidate.maritalStatus !== 'MARRIED') continue;
    const value = candidate[candidateKey];
    if (value === null || value === undefined || value === '') {
      pending.push({ key: `field-${candidateKey}`, label: `Provide your ${label}`, type: 'profile', category: section === 'family' ? 'FAMILY' : 'DETAILS' });
    }
  }
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
    const storedEmploymentHistory = Array.isArray(candidate.employmentHistory) ? candidate.employmentHistory : [];
    const isFresher = storedEmploymentHistory.some((record) => record?.isCurrent === true && record.isFresher === true);
    const currentEmploymentValues = {
      employerName: candidate.currentEmployer,
      employeeId: candidate.employeeId,
      designation: candidate.employeeDesignation,
      department: candidate.employeeDepartment,
      employmentType: candidate.employmentType,
      startDate: candidate.joiningDate,
      workLocation: candidate.workLocation,
      employerHrName: candidate.employerHrName,
      employerHrPhone: candidate.employerHrPhone,
    };
    if (!isFresher) {
      for (const [field, value] of Object.entries(currentEmploymentValues)) {
        if (requiredFields[field]?.required && (value === null || value === undefined || value === '')) {
          pending.push({ key: `field-current-employment-${field}`, label: `Provide your current employer ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}`, type: 'profile', category: 'EMPLOYMENT' });
        }
      }
    }
    storedEmploymentHistory.filter((record) => !isFresher && record && record.isCurrent !== true
      && hasEmploymentHistoryDetails(record)).forEach((record, index) => {
      for (const [field, value] of Object.entries(record)) {
        if (field === 'isCurrent' || field === 'id' || !requiredFields[field]?.required || (value !== null && value !== undefined && value !== '')) continue;
        pending.push({ key: `field-past-employment-${index}-${field}`, label: `Provide ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()} for past employer ${index + 1}`, type: 'profile', category: 'EMPLOYMENT' });
      }
    });
    const requiredEmploymentDocumentTypes = isFresher ? [] : candidateFormConfig.employmentDocuments
      .filter((document) => document.enabled && document.required)
      .map((document) => document.type);
    const enabledEmploymentDocumentTypes = isFresher ? [] : candidateFormConfig.employmentDocuments
      .filter((document) => document.enabled)
      .map((document) => document.type);
    if (requiredEmploymentDocumentTypes.length > 0
      || (candidateFormConfig.requireEmploymentDocumentPerEmployer && enabledEmploymentDocumentTypes.length > 0)) {
      const employmentDocuments = candidate.documents || [];
      const pastEmployerRecords = storedEmploymentHistory
        .filter((record) => record && record.isCurrent !== true)
        .map((record, index) => ({ ...record, id: employmentHistoryRecordId(record, index) }))
        .filter((record) => hasEmploymentHistoryDetails(record)
          || employmentDocuments.some((document) => document.documentNumber === record.id));
      const employerRecords = candidateFormConfig.includeCurrentEmployerInDocumentRequirements
        ? [
          { id: CURRENT_EMPLOYMENT_RECORD_ID, employerName: candidate.currentEmployer, isCurrent: true },
          ...pastEmployerRecords,
        ].slice(0, candidateFormConfig.requiredEmploymentEmployerCount)
        : pastEmployerRecords.slice(0, candidateFormConfig.requiredEmploymentEmployerCount);
      for (const employer of employerRecords) {
        const employerLabel = employer.employerName || (employer.isCurrent ? 'your current employer' : 'this past employer');
        for (const documentType of requiredEmploymentDocumentTypes) {
          const uploaded = employmentDocuments.some((document) =>
            document.documentType === documentType
            && (document.documentNumber === employer.id
              || (employer.id === CURRENT_EMPLOYMENT_RECORD_ID && !document.documentNumber)),
          );
          if (!uploaded) {
            pending.push({
              key: `employment-document-${employer.id}-${documentType}`,
              label: `Upload ${documentType.replaceAll('_', ' ').toLowerCase()} for ${employerLabel}`,
              type: 'document',
              documentType,
              employerId: employer.id,
              category: 'EMPLOYMENT',
            });
          }
        }
        if (candidateFormConfig.requireEmploymentDocumentPerEmployer
          && !employmentDocuments.some((document) =>
            enabledEmploymentDocumentTypes.includes(document.documentType)
            && (document.documentNumber === employer.id
              || (employer.id === CURRENT_EMPLOYMENT_RECORD_ID && !document.documentNumber)),
          )) {
          pending.push({
            key: `employment-document-any-${employer.id}`,
            label: `Upload at least one enabled employment document for ${employerLabel}`,
            type: 'document',
            documentType: enabledEmploymentDocumentTypes[0],
            employerId: employer.id,
            category: 'EMPLOYMENT',
          });
        }
      }
    }
  }

  if (candidateFormConfig.sections.education.enabled) {
    const storedEducationHistory = Array.isArray(candidate.educationHistory) ? candidate.educationHistory : [];
    const legacyEducation = [candidate.highestQualification, candidate.courseName, candidate.institutionName, candidate.universityName, candidate.yearOfPassing, candidate.gradeOrPercentage]
      .some(Boolean)
      ? [{
        qualification: candidate.highestQualification,
        courseName: candidate.courseName,
        institutionName: candidate.institutionName,
        universityName: candidate.universityName,
        yearOfPassing: candidate.yearOfPassing,
        gradeOrPercentage: candidate.gradeOrPercentage,
      }]
      : [];
    const educationRecords = storedEducationHistory.length ? storedEducationHistory : legacyEducation;
    const requiredEducationDocuments = candidateFormConfig.educationDocuments.filter((document) => document.enabled && document.required);
    if (requiredEducationDocuments.length && educationRecords.length === 0) {
      for (const document of requiredEducationDocuments) {
        pending.push({
          key: `education-document-record-${document.type}`,
          label: `Add an education record and upload your ${document.type.replaceAll('_', ' ').toLowerCase()}`,
          type: 'document',
          documentType: document.type,
          category: 'EDUCATION',
        });
      }
    }
    educationRecords.forEach((record, index) => {
      for (const document of requiredEducationDocuments) {
        const recordId = record.id || (educationRecords.length === 1 ? 'legacy-education' : null);
        const uploaded = existingDocuments.some((item) =>
          item.documentType === document.type
          && (item.documentNumber === recordId || (!item.documentNumber && educationRecords.length === 1)),
        );
        if (!uploaded) {
          pending.push({
            key: `education-document-${index}-${document.type}`,
            label: `Upload your ${document.type.replaceAll('_', ' ').toLowerCase()} for education record ${index + 1}`,
            type: 'document',
            documentType: document.type,
            category: 'EDUCATION',
          });
        }
      }
    });
    const requiredEducationFields = Object.keys(requiredFields).filter((field) => (
      ['qualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage'].includes(field)
      && requiredFields[field]?.required
    ));
    if (requiredEducationFields.length && educationRecords.length === 0) {
      pending.push({ key: 'field-education-record', label: 'Add at least one education record', type: 'profile', category: 'EDUCATION' });
    }
    educationRecords.forEach((record, index) => {
      for (const field of requiredEducationFields) {
        if (record[field] === null || record[field] === undefined || record[field] === '') {
          pending.push({ key: `field-education-${index}-${field}`, label: `Provide ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()} for education record ${index + 1}`, type: 'profile', category: 'EDUCATION' });
        }
      }
    });
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

  const profileComplete = Boolean(candidate.firstName && candidate.lastName && candidate.email)
    && !pending.some((item) => item.type === 'profile');
  const requiredDocumentsComplete = !pending.some((item) => item.type === 'document');
  if (!profileComplete) pending.push({ key: 'profile', label: 'Review and complete your details', type: 'profile' });
  const consentReady = !consentComplete && profileComplete && requiredDocumentsComplete
    && (!activeCase || !['COMPLETED', 'CANCELLED'].includes(activeCase.status));
  if (!consentComplete) pending.push({ key: 'consent', label: 'Give background verification consent', type: 'consent' });
  return { activeCase, pending, consentComplete, consentReady, formLocked, uploadsLocked, profileComplete };
};

const getCandidateIntakeStatus = (candidate) => {
  if (!['IN_PROGRESS', 'COMPLETED'].includes(candidate.status)) return candidate.status;
  const progress = pendingFor(candidate);
  return progress.profileComplete && !progress.pending.some((item) => item.type === 'document')
    ? 'COMPLETED'
    : 'IN_PROGRESS';
};

const syncCandidateIntakeStatus = async (candidateId, currentStatus, progress) => {
  if (!['PENDING', 'INVITED', 'IN_PROGRESS', 'COMPLETED'].includes(currentStatus)) return;
  const requiredDocumentsComplete = !progress.pending.some((item) => item.type === 'document');
  const status = progress.profileComplete && requiredDocumentsComplete ? 'COMPLETED' : 'IN_PROGRESS';
  if (status !== currentStatus) {
    await prisma.candidate.update({ where: { id: candidateId }, data: { status } });
  }
};

const toDto = (invitation) => {
  const candidate = invitation.candidate;
  const candidateFormConfig = getCandidateFormConfig(candidate);
  const { activeCase, pending, consentComplete, consentReady, formLocked, uploadsLocked, profileComplete } = pendingFor(candidate);
  const storedEmploymentHistory = Array.isArray(candidate.employmentHistory) ? candidate.employmentHistory : [];
  const currentEmployment = {
    id: CURRENT_EMPLOYMENT_RECORD_ID,
    isCurrent: true,
    isFresher: storedEmploymentHistory.some((record) => record?.isCurrent === true && record.isFresher === true),
    employerName: candidate.currentEmployer,
    employeeId: candidate.employeeId,
    designation: candidate.employeeDesignation,
    department: candidate.employeeDepartment,
    employmentType: candidate.employmentType,
    startDate: candidate.joiningDate,
    endDate: null,
    workLocation: candidate.workLocation,
    employerHrName: candidate.employerHrName,
    employerHrPhone: candidate.employerHrPhone,
  };
  const storedEducationHistory = Array.isArray(candidate.educationHistory) ? candidate.educationHistory : [];
  const educationHistory = storedEducationHistory.length > 0 ? storedEducationHistory : (
    [candidate.highestQualification, candidate.courseName, candidate.institutionName, candidate.universityName, candidate.yearOfPassing, candidate.gradeOrPercentage]
      .some(Boolean)
      ? [{
        id: 'legacy-education',
        qualification: candidate.highestQualification,
        courseName: candidate.courseName,
        institutionName: candidate.institutionName,
        universityName: candidate.universityName,
        yearOfPassing: candidate.yearOfPassing,
        gradeOrPercentage: candidate.gradeOrPercentage,
      }]
      : []
  );
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
      maritalStatus: candidate.maritalStatus,
      spouseName: candidate.spouseName,
      childrenCount: candidate.childrenCount,
      candidateNotes: candidate.candidateNotes,
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
      educationHistory,
      employeeId: candidate.employeeId,
      employeeDesignation: candidate.employeeDesignation,
      employeeDepartment: candidate.employeeDepartment,
      employmentType: candidate.employmentType,
      joiningDate: candidate.joiningDate,
      workLocation: candidate.workLocation,
      currentEmployer: candidate.currentEmployer,
      employerHrName: candidate.employerHrName,
      employerHrPhone: candidate.employerHrPhone,
      employmentHistory: [
        currentEmployment,
        ...storedEmploymentHistory
          .filter((item) => item && item.isCurrent !== true)
          .map((item, index) => ({ ...item, id: employmentHistoryRecordId(item, index) })),
      ],
      currentAddress: candidate.currentAddress,
      permanentAddress: candidate.permanentAddress,
      addressVerificationLocations: candidate.addressVerificationLocations || [],
    },
    company: candidate.company,
    client: candidate.client ? {
      name: candidate.client.name,
      supportEmail: candidate.subclient?.supportEmail || candidate.client.supportEmail,
      supportPhone: candidate.subclient?.supportPhone || candidate.client.supportPhone,
    } : null,
    candidateFormConfig,
    case: activeCase ? { id: activeCase.id, caseNumber: activeCase.caseNumber, status: activeCase.status, checks: activeCase.checks.map((check) => check.type) } : null,
    documents: (candidate.documents || []).map((document) => ({ id: document.id, documentType: document.documentType, documentNumber: document.documentNumber, fileName: document.fileName, fileUrl: document.fileUrl, verificationStatus: document.verificationStatus, uploadedAt: document.uploadedAt })),
    progress: { pending, pendingCount: pending.length, consentComplete, consentReady, formLocked, uploadsLocked, profileComplete },
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
  const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, ...(companyId ? { companyId } : {}), isDeleted: false }, include: { company: true, client: { select: { id: true, name: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } }, subclient: { select: { id: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } } });
  if (!candidate) throw new NotFoundError('Candidate not found');
  if (!candidate.email) throw new BadRequestError('Candidate email is required before sending a portal link.');
  const clientExpiryDays = getCandidateFormConfig(candidate).invitationExpiryDays;
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

const unlockForCorrections = async ({ candidateId, companyId, clientId, expiresInDays }) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId, ...(clientId ? { clientId } : {}), isDeleted: false },
    include: {
      company: true,
      client: { select: { id: true, name: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } },
      subclient: { select: { id: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } },
      consents: { where: { consentType: 'BGV_CONSENT' }, orderBy: { createdAt: 'desc' } },
      bgvCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { checks: { include: { documents: true } }, consents: true },
      },
    },
  });
  if (!candidate) throw new NotFoundError('Candidate not found');
  if (!candidate.email) throw new BadRequestError('Candidate email is required before activating a correction link.');

  const activeCase = candidate.bgvCases[0];
  if (activeCase && ['COMPLETED', 'CANCELLED'].includes(activeCase.status)) {
    throw new ConflictError('A completed or cancelled BGV case cannot be reopened for corrections.');
  }
  const days = Number(expiresInDays ?? getCandidateFormConfig(candidate).invitationExpiryDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_INVITATION_DAYS) {
    throw new BadRequestError(`Link expiry must be between 1 and ${MAX_INVITATION_DAYS} days.`);
  }

  const token = createToken();
  const activatedAt = new Date();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async (transaction) => {
    await transaction.candidateConsent.updateMany({
      where: { candidateId, consentType: 'BGV_CONSENT', consentGiven: true, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return transaction.candidatePortalInvitation.upsert({
      where: { candidateId },
      create: { candidateId, tokenHash: hashToken(token), encryptedToken: encryptToken(token), activatedAt, expiresAt },
      update: {
        tokenHash: hashToken(token),
        encryptedToken: encryptToken(token),
        activatedAt,
        expiresAt,
        revokedAt: null,
        lastSentAt: null,
        lastRemindedAt: null,
        reminderCount: 0,
      },
    });
  });

  const emailSent = await sendInvitationEmail({
    candidate,
    token,
    reminder: false,
    pendingCount: pendingFor(candidate).pending.length,
  });
  const lastSentAt = emailSent ? new Date() : invitation.lastSentAt;
  if (emailSent) {
    await prisma.candidatePortalInvitation.update({ where: { candidateId }, data: { lastSentAt } });
  }
  return { ...toStaffStatus({ ...invitation, lastSentAt }), emailSent };
};

const remind = async ({ candidateId, companyId, clientId }) => {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId, ...(clientId ? { clientId } : {}), isDeleted: false },
    include: { company: true, client: { select: { id: true, name: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } }, subclient: { select: { id: true, supportEmail: true, supportPhone: true, candidateFormConfig: true } }, bgvCases: { orderBy: { createdAt: 'desc' }, take: 1, include: { checks: { include: { documents: true } }, consents: true } } },
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
  const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
  const form = candidateFormConfig.customForms.find((item) =>
    item.id === formId && isCustomFormEnabled(item, candidateFormConfig, invitation.candidate.bgvCases[0]),
  );
  if (!form) throw new NotFoundError('Form template is not available.');
  const formOwner = invitation.candidate.subclient || invitation.candidate.client;
  const legacyFileUrl = formOwner.candidateFormConfig?.customForms?.find((item) => item.id === formId)?.fileUrl;
  const filePath = await findTemplatePath(formOwner.id, formId, legacyFileUrl, form.fileName);
  if (!filePath) throw new NotFoundError('Form template is not available.');
  return { filePath, fileName: form.fileName };
};
const assertPortalEditable = async (token) => {
  const invitation = await findInvitation(token);
  if (areUploadsLocked(invitation.candidate)) {
    throw new ConflictError('Document uploads are locked after the verification case is completed or cancelled.');
  }
};

const updateProfile = async (token, payload) => {
  const invitation = await findInvitation(token);
  if (isPortalLocked(invitation.candidate)) {
    throw new ConflictError('Candidate details cannot be changed after consent or case completion.');
  }
  const immutableFields = ['fullName', 'firstName', 'middleName', 'lastName', 'email'];
  if (immutableFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
    throw new BadRequestError('Name and email address cannot be changed from the candidate portal. Contact the inviting company to request a correction.');
  }
  const allowed = ['phone', 'dateOfBirth', 'gender', 'fatherName', 'motherName', 'maritalStatus', 'spouseName', 'childrenCount', 'candidateNotes', 'aadhaarNumber', 'panNumber', 'uanNumber', 'passportNumber', 'drivingLicenseNumber', 'voterIdNumber', 'highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage', 'educationHistory', 'employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer', 'employerHrName', 'employerHrPhone', 'currentAddress', 'permanentAddress', 'addressVerificationLocations'];
  const data = {};
  for (const field of allowed) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }
  const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
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
  if (data.addressVerificationLocations !== undefined) {
    if (!candidateFormConfig.sections.address.enabled) {
      throw new BadRequestError('Address details are not enabled for this client’s candidate form.');
    }
    const availableLocations = new Set([
      ...(addressConfig.currentAddressEnabled ? ['current'] : []),
      ...(addressConfig.permanentAddressEnabled ? ['permanent'] : []),
    ]);
    if (!Array.isArray(data.addressVerificationLocations)
      || data.addressVerificationLocations.some((location) => typeof location !== 'string' || !availableLocations.has(location))
      || new Set(data.addressVerificationLocations).size !== data.addressVerificationLocations.length) {
      throw new BadRequestError('Select only enabled address locations for verification.');
    }
  }
  for (const field of IDENTITY_FIELDS) {
    if (data[field.key] !== undefined && !candidateFormConfig[field.key].enabled) {
      throw new BadRequestError(`${field.label} is not enabled for this client’s candidate form.`);
    }
  }
  const disabledSectionFields = {
    family: ['fatherName', 'motherName', 'maritalStatus', 'spouseName', 'childrenCount'],
    education: ['highestQualification', 'courseName', 'institutionName', 'universityName', 'yearOfPassing', 'gradeOrPercentage'],
    employment: ['employeeId', 'employeeDesignation', 'employeeDepartment', 'employmentType', 'joiningDate', 'workLocation', 'currentEmployer', 'employerHrName', 'employerHrPhone'],
  };
  for (const [section, fields] of Object.entries(disabledSectionFields)) {
    if (!candidateFormConfig.sections[section].enabled && fields.some((field) => data[field] !== undefined)) {
      throw new BadRequestError(`${section} details are not enabled for this client’s candidate form.`);
    }
  }
  if (data.maritalStatus !== undefined) {
    const allowedStatuses = new Set(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']);
    data.maritalStatus = typeof data.maritalStatus === 'string' ? data.maritalStatus.trim().toUpperCase() : '';
    if (data.maritalStatus && !allowedStatuses.has(data.maritalStatus)) {
      throw new BadRequestError('Marital status is invalid.');
    }
    if (!data.maritalStatus) data.maritalStatus = null;
  }
  if (data.spouseName !== undefined) {
    if (typeof data.spouseName !== 'string') throw new BadRequestError('Spouse name must be text.');
    data.spouseName = data.spouseName.trim() || null;
    if (data.spouseName?.length > 255) throw new BadRequestError('Spouse name cannot exceed 255 characters.');
  }
  if ((data.maritalStatus ?? invitation.candidate.maritalStatus) !== 'MARRIED' && data.spouseName !== undefined) {
    data.spouseName = null;
  }
  if (data.childrenCount !== undefined) {
    if (data.childrenCount === '' || data.childrenCount === null) {
      data.childrenCount = null;
    } else if (!Number.isInteger(data.childrenCount) || data.childrenCount < 0 || data.childrenCount > 20) {
      throw new BadRequestError('Number of children must be between 0 and 20.');
    }
  }
  if (data.candidateNotes !== undefined) {
    if (typeof data.candidateNotes !== 'string') throw new BadRequestError('Notes must be text.');
    data.candidateNotes = data.candidateNotes.trim() || null;
    if (data.candidateNotes?.length > 2000) throw new BadRequestError('Notes cannot exceed 2,000 characters.');
  }
  if (payload.educationHistory !== undefined) {
    if (!candidateFormConfig.sections.education.enabled) {
      throw new BadRequestError('Education details are not enabled for this client’s candidate form.');
    }
    if (!Array.isArray(payload.educationHistory) || payload.educationHistory.length > 5) {
      throw new BadRequestError('Provide up to 5 higher education records.');
    }
    data.educationHistory = payload.educationHistory.map((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new BadRequestError('Each education record must be an object.');
      }
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new BadRequestError('Each education record must have a valid ID.');
      const normalized = { id };
      for (const [field, maxLength] of Object.entries(EDUCATION_HISTORY_FIELDS)) {
        const value = record[field];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          throw new BadRequestError(`${field} must be text.`);
        }
        const text = typeof value === 'string' ? value.trim() : '';
        if (text.length > maxLength) throw new BadRequestError(`${field} cannot exceed ${maxLength} characters.`);
        normalized[field] = text || null;
      }
      if (normalized.yearOfPassing) {
        const year = Number(normalized.yearOfPassing);
        if (!/^\d{4}$/.test(normalized.yearOfPassing) || year < 1950 || year > new Date().getFullYear() + 1) {
          throw new BadRequestError('Enter a valid 4-digit year of passing.');
        }
      }
      return normalized;
    });
    if (new Set(data.educationHistory.map((record) => record.id)).size !== data.educationHistory.length) {
      throw new BadRequestError('Education record IDs must be unique.');
    }
    const highest = data.educationHistory[0] || {};
    data.highestQualification = highest.qualification || null;
    data.courseName = highest.courseName || null;
    data.institutionName = highest.institutionName || null;
    data.universityName = highest.universityName || null;
    data.yearOfPassing = highest.yearOfPassing || null;
    data.gradeOrPercentage = highest.gradeOrPercentage || null;
  }
  if (payload.employmentHistory !== undefined) {
    if (!candidateFormConfig.sections.employment.enabled) {
      throw new BadRequestError('employment details are not enabled for this client’s candidate form.');
    }
    if (!Array.isArray(payload.employmentHistory) || payload.employmentHistory.length < 1 || payload.employmentHistory.length > 10) {
      throw new BadRequestError('Provide between 1 and 10 employment records.');
    }
    data.employmentHistory = payload.employmentHistory.map((record, index) => {
      if (!record || typeof record !== 'object' || Array.isArray(record) || record.isCurrent !== (index === 0)) {
        throw new BadRequestError('The first employment record must be current and all other records must be past employment.');
      }
      const suppliedId = typeof record.id === 'string' ? record.id.trim() : '';
      if (record.id !== undefined
        && (typeof record.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(suppliedId))) {
        throw new BadRequestError('Each employment record must have a valid ID.');
      }
      const normalized = {
        id: index === 0 ? CURRENT_EMPLOYMENT_RECORD_ID : suppliedId || `employment-past-${index}`,
        isCurrent: index === 0,
      };
      if (index === 0) {
        if (record.isFresher !== undefined && typeof record.isFresher !== 'boolean') {
          throw new BadRequestError('The fresher selection must be a boolean.');
        }
        normalized.isFresher = record.isFresher === true;
      }
      for (const [field, maxLength] of Object.entries(EMPLOYMENT_HISTORY_FIELDS)) {
        const value = record[field];
        if (value !== undefined && value !== null && typeof value !== 'string') {
          throw new BadRequestError(`${field} must be text.`);
        }
        const text = typeof value === 'string' ? value.trim() : '';
        if (text.length > maxLength) throw new BadRequestError(`${field} cannot exceed ${maxLength} characters.`);
        normalized[field] = text || null;
      }
      const startDate = record.startDate ? parseDateValue(record.startDate, 'Employment start date') : null;
      const endDate = record.endDate ? parseDateValue(record.endDate, 'Employment end date') : null;
      if (normalized.employerHrPhone && !/^[+()\-\s\d]{7,18}$/.test(normalized.employerHrPhone)) {
        throw new BadRequestError('Enter a valid employer HR contact number.');
      }
      if (index === 0 && endDate) throw new BadRequestError('Current employment cannot have an end date.');
      if (startDate && endDate && endDate < startDate) {
        throw new BadRequestError('Employment end date cannot be before the start date.');
      }
      normalized.startDate = startDate ? startDate.toISOString().slice(0, 10) : null;
      normalized.endDate = endDate ? endDate.toISOString().slice(0, 10) : null;
      return normalized;
    });
    if (new Set(data.employmentHistory.map((record) => record.id)).size !== data.employmentHistory.length) {
      throw new BadRequestError('Employment record IDs must be unique.');
    }
    const current = data.employmentHistory[0];
    data.currentEmployer = current.employerName;
    data.employeeId = current.employeeId;
    data.employeeDesignation = current.designation;
    data.employeeDepartment = current.department;
    data.employmentType = current.employmentType;
    data.joiningDate = current.startDate ? parseDateValue(current.startDate, 'Employment start date') : null;
    data.workLocation = current.workLocation;
    data.employerHrName = current.employerHrName;
    data.employerHrPhone = current.employerHrPhone;
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
      data[dateField] = parseDateValue(data[dateField], dateField);
    }
  }
  if (!Object.keys(data).length) throw new BadRequestError('Provide at least one detail to update.');
  const candidateAfterUpdate = { ...invitation.candidate, ...data };
  const progress = pendingFor(candidateAfterUpdate);
  const nextStatus = ['PENDING', 'INVITED', 'IN_PROGRESS', 'COMPLETED'].includes(invitation.candidate.status)
    ? progress.profileComplete && !progress.pending.some((item) => item.type === 'document') ? 'COMPLETED' : 'IN_PROGRESS'
    : invitation.candidate.status;
  await prisma.candidate.update({ where: { id: invitation.candidateId }, data: { ...data, status: nextStatus } });
  return getPortal(token);
};

const recordConsent = async (token, payload, request) => {
  const invitation = await findInvitation(token);
  const activeCase = invitation.candidate.bgvCases[0];
  if (activeCase && ['COMPLETED', 'CANCELLED'].includes(activeCase.status)) throw new ConflictError('This candidate form is locked because the BGV case is finalized.');
  if (payload.consentGiven !== true) throw new BadRequestError('Consent must be explicitly accepted.');
  const existingConsents = [...(activeCase?.consents || []), ...(invitation.candidate.consents || [])];
  if (existingConsents.some((consent) =>
    consent.consentType === 'BGV_CONSENT' && consent.consentGiven && !consent.revokedAt,
  )) {
    throw new ConflictError('Consent has already been recorded.');
  }
  const progress = pendingFor(invitation.candidate);
  if (!progress.consentReady) {
    throw new BadRequestError('Complete all required profile fields and upload every required client form before submitting consent.');
  }
  const data = {
    consentGiven: true,
    consentVersion: '1.1',
    consentText: consentTextFor(invitation.candidate.company.name, invitation.candidate.client?.name),
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
    consentedAt: new Date(),
    revokedAt: null,
  };
  await prisma.candidateConsent.create({
    data: { candidateId: invitation.candidateId, caseId: activeCase?.id || null, consentType: 'BGV_CONSENT', ...data },
  });
  return getPortal(token);
};

const addDocument = async (token, file, documentType, documentNumber, customFormId, documentCategory) => {
  const invitation = await findInvitation(token);
  if (areUploadsLocked(invitation.candidate)) {
    if (file?.path) await fs.unlink(file.path).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    throw new ConflictError('Document uploads are locked after the verification case is completed or cancelled.');
  }
  if (!file) throw new BadRequestError('Choose a document to upload.');
  if (!DOCUMENT_TYPES.has(documentType)) await rejectDocumentUpload(file, 'Document type is invalid.');
  if (documentCategory !== undefined && !['EMPLOYMENT', 'ADDRESS', 'EDUCATION'].includes(documentCategory)) {
    await rejectDocumentUpload(file, 'Document category is invalid.');
  }
  if (documentCategory === 'ADDRESS') {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
    const addressDocument = candidateFormConfig.address.documents.find((item) => item.type === documentType && item.enabled);
    const requestedByCase = invitation.candidate.bgvCases[0]?.checks.some((check) => check.type === documentType);
    if ((!candidateFormConfig.sections.address.enabled || !addressDocument) && !requestedByCase) {
      await rejectDocumentUpload(file, 'This address document type is not enabled for this client.');
    }
  } else if (documentCategory === 'EMPLOYMENT') {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
    const employmentDocument = candidateFormConfig.employmentDocuments.find((item) => item.type === documentType && item.enabled);
    if (!candidateFormConfig.sections.employment.enabled || !employmentDocument) {
      await rejectDocumentUpload(file, 'This employment document type is not enabled for this client.');
    }
  } else if (documentCategory === 'EDUCATION') {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
    const educationDocument = candidateFormConfig.educationDocuments.find((item) => item.type === documentType && item.enabled);
    if (!candidateFormConfig.sections.education.enabled || !educationDocument) {
      await rejectDocumentUpload(file, 'This education document type is not enabled for this client.');
    }
  } else if (ADDRESS_DOCUMENT_TYPES.includes(documentType)) {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
    const addressDocument = candidateFormConfig.address.documents.find((item) => item.type === documentType && item.enabled);
    const requestedByCase = invitation.candidate.bgvCases[0]?.checks.some((check) => check.type === documentType);
    if ((!candidateFormConfig.sections.address.enabled || !addressDocument) && !requestedByCase) {
      await rejectDocumentUpload(file, 'This address document type is not enabled for this client.');
    }
  } else if (EMPLOYMENT_DOCUMENT_TYPES.includes(documentType) && documentType !== 'OTHER') {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
    if (!candidateFormConfig.employmentDocuments.some((item) => item.type === documentType && item.enabled)) {
      await rejectDocumentUpload(file, 'This employment document type is not enabled for this client.');
    }
  }
  let storedDocumentNumber = documentNumber?.trim() || null;
  let customForm = null;
  if (customFormId) {
    const candidateFormConfig = getCandidateFormConfig(invitation.candidate);
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
    && !getCandidateFormConfig(invitation.candidate)[identityField.key].enabled) {
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
  const status = await getPortal(token);
  await syncCandidateIntakeStatus(invitation.candidateId, invitation.candidate.status, status.progress);
  return { document, status };
};

const deletePortalDocument = async (token, documentId) => {
  const invitation = await findInvitation(token);
  if (areUploadsLocked(invitation.candidate)) {
    throw new ConflictError('Document uploads are locked after the verification case is completed or cancelled.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(documentId || '')) throw new NotFoundError('Uploaded form not found.');

  const document = await prisma.candidateDocument.findFirst({
    where: { id: documentId, candidateId: invitation.candidateId },
    select: { id: true, fileUrl: true },
  });
  if (!document) {
    throw new NotFoundError('Uploaded form not found.');
  }

  const portalFileMatch = /^\/uploads\/candidate-documents\/portal\/([a-f0-9]{64})\/([^/\\]+)$/i.exec(document.fileUrl);
  if (!portalFileMatch) throw new BadRequestError('Only documents uploaded through this candidate portal can be deleted here.');
  const [, uploadToken, fileName] = portalFileMatch;
  if (!fileName || path.basename(fileName) !== fileName || fileName === '.' || fileName === '..') {
    throw new BadRequestError('Uploaded form file path is invalid.');
  }

  const portalUploadDirectory = path.resolve(process.cwd(), 'uploads', 'candidate-documents', 'portal', uploadToken);
  const filePath = path.resolve(portalUploadDirectory, fileName);
  if (path.dirname(filePath) !== portalUploadDirectory) throw new BadRequestError('Uploaded form file path is invalid.');

  const deleted = await prisma.candidateDocument.deleteMany({
    where: { id: document.id, candidateId: invitation.candidateId },
  });
  if (!deleted.count) throw new NotFoundError('Uploaded form not found.');
  await fs.unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  const status = await getPortal(token);
  await syncCandidateIntakeStatus(invitation.candidateId, invitation.candidate.status, status.progress);
  return status;
};

module.exports = { issue, unlockForCorrections, remind, getPortal, getCandidateFormTemplate, getStaffStatus, lock, getCandidateIntakeStatus, updateProfile, recordConsent, assertPortalEditable, addDocument, deletePortalDocument };
