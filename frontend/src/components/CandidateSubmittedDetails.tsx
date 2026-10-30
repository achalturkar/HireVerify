'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { candidatePortalFileUrl } from '@/src/lib/candidate-portal-forms';
import { candidateDocumentDisplayName, candidateDocumentReviewClass, candidateDocumentReviewLabel } from '@/src/lib/candidate-document-display';

type FieldDefinition = { key: string; label: string };
type SectionDefinition = { title: string; fields: FieldDefinition[] };

const sections: SectionDefinition[] = [
  {
    title: 'Personal details',
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'firstName', label: 'First name' },
      { key: 'middleName', label: 'Middle name' },
      { key: 'lastName', label: 'Last name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'dateOfBirth', label: 'Date of birth' },
      { key: 'gender', label: 'Gender' },
    ],
  },
  {
    title: 'Family details',
    fields: [
      { key: 'fatherName', label: "Father's name" },
      { key: 'motherName', label: "Mother's name" },
      { key: 'maritalStatus', label: 'Marital status' },
      { key: 'spouseName', label: 'Spouse name' },
      { key: 'childrenCount', label: 'Number of children' },
    ],
  },
  {
    title: 'Candidate notes',
    fields: [{ key: 'candidateNotes', label: 'Notes for the verification team' }],
  },
  {
    title: 'Identity details',
    fields: [
      { key: 'aadhaarNumber', label: 'Aadhaar number' },
      { key: 'panNumber', label: 'PAN number' },
      { key: 'uanNumber', label: 'UAN number' },
      { key: 'passportNumber', label: 'Passport number' },
      { key: 'drivingLicenseNumber', label: 'Driving licence number' },
      { key: 'voterIdNumber', label: 'Voter ID number' },
    ],
  },
  {
    title: 'Education details',
    fields: [
      { key: 'highestQualification', label: 'Highest qualification' },
      { key: 'courseName', label: 'Course or degree' },
      { key: 'institutionName', label: 'Institution' },
      { key: 'universityName', label: 'University or board' },
      { key: 'yearOfPassing', label: 'Year of passing' },
      { key: 'gradeOrPercentage', label: 'Grade or percentage' },
    ],
  },
  {
    title: 'Employment details',
    fields: [
      { key: 'currentEmployer', label: 'Current employer' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeDesignation', label: 'Designation' },
      { key: 'employeeDepartment', label: 'Department' },
      { key: 'employmentType', label: 'Employment type' },
      { key: 'joiningDate', label: 'Joining date' },
      { key: 'workLocation', label: 'Work location' },
      { key: 'employerHrName', label: 'Employer HR contact name' },
      { key: 'employerHrPhone', label: 'Employer HR contact number' },
    ],
  },
  {
    title: 'Addresses',
    fields: [
      { key: 'currentAddress', label: 'Current address' },
      { key: 'permanentAddress', label: 'Permanent address' },
      { key: 'addressVerificationLocations', label: 'Addresses selected for verification' },
    ],
  },
];

const educationFields: FieldDefinition[] = [
  { key: 'qualification', label: 'Qualification' },
  { key: 'courseName', label: 'Course or degree' },
  { key: 'institutionName', label: 'Institution' },
  { key: 'universityName', label: 'University or board' },
  { key: 'yearOfPassing', label: 'Year of passing' },
  { key: 'gradeOrPercentage', label: 'Grade or percentage' },
];

const employmentFields: FieldDefinition[] = [
  { key: 'employerName', label: 'Employer' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'employmentType', label: 'Employment type' },
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
  { key: 'workLocation', label: 'Work location' },
  { key: 'employerHrName', label: 'Employer HR contact name' },
  { key: 'employerHrPhone', label: 'Employer HR contact number' },
];

const identityKeys = new Set([
  'aadhaarNumber',
  'panNumber',
  'uanNumber',
  'passportNumber',
  'drivingLicenseNumber',
  'voterIdNumber',
]);

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return false;
  return String(value).trim() !== '';
}

function displayValue(value: unknown, key: string, revealIdentity: boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.map((item) => String(item).replaceAll('_', ' ')).join(', ');
  }
  const text = String(value);
  if (identityKeys.has(key) && !revealIdentity && text.length > 4) {
    return `${'•'.repeat(text.length - 4)}${text.slice(-4)}`;
  }
  if (['dateOfBirth', 'joiningDate', 'startDate', 'endDate'].includes(key)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  if (['gender', 'maritalStatus', 'employmentType'].includes(key)) {
    return text.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  }
  return text;
}

function fieldRows(
  values: Map<string, unknown>,
  fields: FieldDefinition[],
  revealIdentity: boolean,
) {
  return fields
    .map(({ key, label }) => ({ key, label, value: values.get(key) }))
    .filter(({ value }) => isFilled(value))
    .map(({ key, label, value }) => (
      <div key={key} className={key.endsWith('Address') || key === 'candidateNotes' ? 'sm:col-span-2 lg:col-span-3' : ''}>
        <dt className="text-xs font-medium text-[var(--muted)]">{label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{displayValue(value, key, revealIdentity)}</dd>
      </div>
    ));
}

function recordValues(value: unknown): Map<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return new Map<string, unknown>(Object.entries(value));
}

function additionalFields(values: Map<string, unknown>, knownKeys: Set<string>, excludedKeys: Set<string> = new Set()): FieldDefinition[] {
  return Array.from(values.keys())
    .filter((key) => !knownKeys.has(key) && !excludedKeys.has(key) && isFilled(values.get(key)))
    .map((key) => ({
      key,
      label: key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase()),
    }));
}

export default function CandidateSubmittedDetails({ candidate }: { candidate: object }) {
  const [revealIdentity, setRevealIdentity] = useState(false);
  const values = new Map<string, unknown>(Object.entries(candidate));
  const educationRecords = Array.isArray(values.get('educationHistory')) ? values.get('educationHistory') as unknown[] : [];
  const employmentRecords = Array.isArray(values.get('employmentHistory')) ? values.get('employmentHistory') as unknown[] : [];
  const isFresher = employmentRecords.some((record) => {
    const fields = recordValues(record);
    return fields?.get('isCurrent') === true && fields.get('isFresher') === true;
  });
  const populatedSections = sections
    .map((section) => ({ ...section, rows: fieldRows(values, section.fields, revealIdentity) }))
    .filter((section) => section.rows.length > 0);
  const knownCandidateKeys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const excludedCandidateKeys = new Set([
    'id', 'companyId', 'clientId', 'subclientId', 'createdById', 'updatedById', 'createdAt', 'updatedAt',
    'candidateCode', 'status', 'isDeleted', 'deletedAt', 'documents', 'consents', 'portalInvitation',
    'client', 'company', 'subclient', 'bgvCases', 'bgvCaseCount', 'portalLinkExpiryDays',
    'educationHistory', 'employmentHistory', 'addressVerificationLocations',
  ]);
  const extraCandidateFields = additionalFields(values, knownCandidateKeys, excludedCandidateKeys);
  const populatedEducation = educationRecords
    .map(recordValues)
    .filter((record): record is Map<string, unknown> => record !== null)
    .map((record) => ({
      record,
      rows: fieldRows(record, educationFields, revealIdentity),
      extraRows: fieldRows(record, additionalFields(record, new Set(educationFields.map((field) => field.key)), new Set(['id'])), revealIdentity),
    }))
    .filter(({ rows, extraRows }) => rows.length > 0 || extraRows.length > 0);
  const populatedEmployment = employmentRecords
    .map(recordValues)
    .filter((record): record is Map<string, unknown> => record !== null)
    .filter((record) => !isFresher || record.get('isCurrent') === true)
    .map((record) => ({
      record,
      rows: fieldRows(record, employmentFields, revealIdentity),
      extraRows: fieldRows(
        record,
        additionalFields(record, new Set(employmentFields.map((field) => field.key)), new Set(['id', 'isCurrent', 'isFresher'])),
        revealIdentity,
      ),
    }))
    .filter(({ rows, extraRows, record }) => rows.length > 0 || extraRows.length > 0 || (record.get('isCurrent') === true && record.get('isFresher') === true));
  const documentRecords = values.get('documents');
  const documents = Array.isArray(documentRecords)
    ? documentRecords.map(recordValues).filter((record): record is Map<string, unknown> => record !== null)
    : [];

  if (!populatedSections.length && !populatedEducation.length && !populatedEmployment.length && !extraCandidateFields.length && !documents.length) {
    return <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">The candidate has not submitted profile details yet.</p>;
  }

  return (
    <div className="space-y-5">
      {sections.some((section) => section.title === 'Identity details' && fieldRows(values, section.fields, false).length > 0) && (
        <div className="flex justify-end">
          <button type="button" onClick={() => setRevealIdentity((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium">
            {revealIdentity ? <EyeOff size={14} /> : <Eye size={14} />}
            {revealIdentity ? 'Hide identity numbers' : 'Reveal identity numbers'}
          </button>
        </div>
      )}
      {populatedSections.map((section) => (
        <section key={section.title} className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-4 text-sm font-semibold">{section.title}</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{section.rows}</dl>
        </section>
      ))}
      {extraCandidateFields.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Additional submitted details</h3>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {fieldRows(values, extraCandidateFields, revealIdentity)}
          </dl>
        </section>
      )}
      {populatedEducation.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Education history</h3>
          <div className="space-y-4">
            {populatedEducation.map(({ record, rows, extraRows }, index) => (
              <dl key={`education-${index}`} className="grid gap-x-6 gap-y-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3"><h4 className="text-xs font-semibold">{String(record.get('qualification') || `Education record ${index + 1}`)}</h4></div>
                {rows}
                {extraRows}
              </dl>
            ))}
          </div>
        </section>
      )}
      {(populatedEmployment.length > 0 || isFresher) && (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-2 text-sm font-semibold">Employment history</h3>
          {isFresher && <p className="mb-4 text-xs text-[var(--muted)]">Candidate marked as a fresher; past employment details are not requested.</p>}
          <div className="space-y-4">
            {populatedEmployment.map(({ record, rows, extraRows }, index) => (
              <dl key={`employment-${index}`} className="grid gap-x-6 gap-y-4 rounded-lg border border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3"><h4 className="text-xs font-semibold">{record.get('isCurrent') ? 'Current employment' : String(record.get('employerName') || `Past employment ${index}`)}</h4></div>
                {rows}
                {record.get('isCurrent') === true && record.get('isFresher') === true && (
                  <div>
                    <dt className="text-xs font-medium text-[var(--muted)]">Candidate type</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">Fresher</dd>
                  </div>
                )}
                {extraRows}
              </dl>
            ))}
          </div>
        </section>
      )}
      {documents.length > 0 && (
        <section className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Uploaded documents</h3>
          <ul className="divide-y divide-[var(--border)]">
            {documents.map((document, index) => {
              const fileUrl = document.get('fileUrl');
              const fileName = document.get('fileName');
              const documentType = String(document.get('documentType') || 'OTHER');
              const documentNumber = document.get('documentNumber');
              const verificationStatus = String(document.get('verificationStatus') || 'PENDING');
              const displayName = candidateDocumentDisplayName(
                { documentType, documentNumber: typeof documentNumber === 'string' ? documentNumber : null },
                candidate as Parameters<typeof candidateDocumentDisplayName>[1],
              );
              return (
                <li key={String(document.get('id') || `${documentType}-${index}`)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{displayName}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {String(fileName || 'File name unavailable')}
                      {isFilled(document.get('uploadedAt')) && ` · Uploaded ${String(document.get('uploadedAt')).slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${candidateDocumentReviewClass(verificationStatus)}`}>{candidateDocumentReviewLabel(verificationStatus)}</span>
                    {typeof fileUrl === 'string' && fileUrl && (
                      <a href={candidatePortalFileUrl(fileUrl)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                        Open file
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
