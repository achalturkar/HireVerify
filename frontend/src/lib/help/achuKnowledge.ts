export interface AchuHelpEntry {
  id: string;
  title: string;
  keywords: string[];
  phrases: string[];
  answer: string;
  href: string;
  linkLabel: string;
  nextSteps: string[];
}

export const ACHU_KNOWLEDGE: AchuHelpEntry[] = [
  {
    id: 'start',
    title: 'Getting started',
    keywords: ['start', 'begin', 'workflow', 'next', 'first', 'process', 'onboard', 'onboarding'],
    phrases: ['what next', 'how do i start', 'getting started', 'next step'],
    answer: 'A good starting flow is: set up your company profile, add a client, add a candidate, create a BGV case, complete its checks, review the result, and share the report. Create an invoice when you are ready to bill the client.',
    href: '/company/help',
    linkLabel: 'Open the portal guide',
    nextSteps: ['Check your company profile', 'Create or select a client', 'Add a candidate'],
  },
  {
    id: 'clients',
    title: 'Clients',
    keywords: ['client', 'clients', 'customer', 'customers', 'organization', 'organizations', 'company', 'contact', 'contacts'],
    phrases: ['add client', 'create client', 'client details', 'client steps'],
    answer: 'Create a client record before opening a case. Add the organization name and contact details, then use that client when creating candidates and BGV cases. Keeping client billing details up to date also makes invoice preparation easier.',
    href: '/company/clients',
    linkLabel: 'Open Clients',
    nextSteps: ['Select New client', 'Enter organization and contact details', 'Save, then add a candidate'],
  },
  {
    id: 'candidates',
    title: 'Candidates',
    keywords: ['candidate', 'candidates', 'applicant', 'applicants', 'person', 'people', 'profile'],
    phrases: ['add candidate', 'create candidate', 'candidate profile', 'candidate steps'],
    answer: 'Add a candidate from Candidates and associate them with the correct client. Review the candidate details before creating a case so the verification is attached to the right person and organization.',
    href: '/company/candidates',
    linkLabel: 'Open Candidates',
    nextSteps: ['Choose Add candidate', 'Enter the candidate details', 'Select the matching client'],
  },
  {
    id: 'cases',
    title: 'BGV cases',
    keywords: ['case', 'cases', 'bgv', 'background', 'initiate', 'initiated', 'initiation', 'casework'],
    phrases: ['create case', 'new case', 'start verification', 'initiate bgv', 'case steps'],
    answer: 'Open BGV Cases and choose New case. Select the client and candidate, choose the checks required for the package, and save or initiate the case. You can track its status and filter cases by client, status, and initiation date.',
    href: '/company/bgv-cases',
    linkLabel: 'Open BGV Cases',
    nextSteps: ['Choose New case', 'Select a client and candidate', 'Select checks and initiate'],
  },
  {
    id: 'checks',
    title: 'Verification checks',
    keywords: ['check', 'checks', 'verification', 'verifications', 'pending', 'upload', 'document', 'documents', 'result', 'results'],
    phrases: ['complete a check', 'run a check', 'verification status', 'upload document', 'check steps'],
    answer: 'Open a case and select one of its check tabs to enter findings and supporting documents. Provider-based checks can be run from Verification Checks; manual checks are completed by entering the result and evidence in the case. The available tabs depend on the checks selected for that case.',
    href: '/company/verifications',
    linkLabel: 'Open Verification Checks',
    nextSteps: ['Open the relevant case', 'Choose the check tab', 'Enter the result and save supporting evidence'],
  },
  {
    id: 'manual-bgv',
    title: 'Manual BGV',
    keywords: ['manual', 'offline', 'phone', 'external'],
    phrases: ['manual bgv', 'outside the portal', 'manual verification'],
    answer: 'Use Manual BGV to record a check completed outside the normal portal flow, such as a phone or email verification. Enter the findings and attach supporting evidence so the work is recorded.',
    href: '/company/manual-bgv',
    linkLabel: 'Open Manual BGV',
    nextSteps: ['Choose the client and candidate', 'Enter the check findings', 'Attach supporting evidence and save'],
  },
  {
    id: 'review',
    title: 'Reviewing a case',
    keywords: ['review', 'reviews', 'approve', 'approval', 'complete', 'completed', 'status'],
    phrases: ['case awaiting review', 'review a case', 'mark completed'],
    answer: 'When the required checks are finished, open the case and review the recorded results and evidence. Use the case status controls to move it through review and completion. Completed case details are view-only until the case status is changed.',
    href: '/company/bgv-cases',
    linkLabel: 'Open BGV Cases',
    nextSteps: ['Filter cases by Under review', 'Review each check and its evidence', 'Update the case status when ready'],
  },
  {
    id: 'reports',
    title: 'Reports',
    keywords: ['report', 'reports', 'pdf', 'download', 'send', 'email', 'share'],
    phrases: ['generate report', 'send report', 'download report', 'share report', 'report steps'],
    answer: 'You can preview or download a report from its case. To email reports to a client, open Reports, select the client, select completed cases, and choose Send selected to client.',
    href: '/company/reports',
    linkLabel: 'Open Reports',
    nextSteps: ['Open Reports or a completed case', 'Preview or download the report', 'Select a client and email completed reports when ready'],
  },
  {
    id: 'invoices',
    title: 'Invoices and payments',
    keywords: ['invoice', 'invoices', 'billing', 'bill', 'bills', 'payment', 'payments', 'paid', 'overdue', 'balance', 'tax', 'gst'],
    phrases: ['create invoice', 'send invoice', 'record payment', 'invoice overdue', 'billing profile', 'invoice steps', 'how to invoice'],
    answer: 'Use Invoices to manage the full billing flow. First confirm your business billing profile, then select a client and add service lines or eligible BGV cases. Review quantities, rates, discounts, tax, invoice date, and due date. Preview the invoice before sending it to the client or downloading the PDF. Record payments as they arrive to keep the balance and status up to date.',
    href: '/company/invoices',
    linkLabel: 'Open Invoices',
    nextSteps: ['Open Billing profile and confirm your business and bank details', 'Choose a client and add services or eligible BGV cases as invoice lines', 'Check quantities, rates, discounts, taxes, and due date', 'Preview the invoice, then email it or download the PDF', 'Record each payment to update the paid amount and balance due'],
  },
  {
    id: 'users',
    title: 'Users and roles',
    keywords: ['user', 'users', 'team', 'invite', 'invitation', 'role', 'roles', 'permission', 'permissions', 'access'],
    phrases: ['add user', 'invite teammate', 'change permissions', 'assign role', 'user steps'],
    answer: 'Use Users to manage team accounts and Roles to define what each role can view or manage. Assign access according to the person’s responsibilities, especially for sensitive case, report, and billing actions.',
    href: '/company/users',
    linkLabel: 'Open Users',
    nextSteps: ['Add or select a team member', 'Review available roles', 'Assign the role that matches their work'],
  },
  {
    id: 'profile-settings',
    title: 'Company profile and settings',
    keywords: ['profile', 'settings', 'logo', 'address', 'branding', 'configuration', 'preference', 'preferences'],
    phrases: ['update company profile', 'change logo', 'portal settings', 'profile steps'],
    answer: 'Company Profile holds your organization identity and contact details used around the portal and on reports. Settings contains workspace preferences. Keep profile details accurate before generating client-facing reports.',
    href: '/company/profile',
    linkLabel: 'Open Company Profile',
    nextSteps: ['Review company name and contact details', 'Update branding if needed', 'Check workspace preferences in Settings'],
  },
  {
    id: 'government-portals',
    title: 'Government portals',
    keywords: ['government', 'portal', 'portals', 'official', 'website', 'websites'],
    phrases: ['government portal', 'external verification site', 'government steps'],
    answer: 'Government Portals provides quick links to external sites that may be useful while working on identity, education, or police checks. Follow each external portal’s own instructions and record relevant findings in the case.',
    href: '/company/government-portals',
    linkLabel: 'Open Government Portals',
    nextSteps: ['Find the relevant external portal', 'Complete the external check', 'Record findings and evidence in the case'],
  },
  {
    id: 'help',
    title: 'Help and support',
    keywords: ['help', 'support', 'contact', 'guide', 'achu', 'assistant'],
    phrases: ['contact support', 'need help', 'what can you do', 'support steps'],
    answer: 'I’m ACHU, HireVerify’s built-in portal guide. Ask about clients, candidates, BGV cases, verification checks, reports, invoices, users, or settings. For account-specific or technical issues, open the Help page to contact the support team.',
    href: '/company/help',
    linkLabel: 'Open Help and support',
    nextSteps: ['Describe the page or workflow you need help with', 'Include a case or invoice reference if relevant', 'Contact support for account-specific issues'],
  },
];

const STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'can', 'do', 'for', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'please', 'the', 'to', 'want', 'what', 'with']);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(value: string) {
  return normalize(value).split(' ').filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function findAchuAnswer(question: string): AchuHelpEntry | null {
  const normalizedQuestion = normalize(question);
  const questionTokens = new Set(tokens(question));
  if (!questionTokens.size) return null;

  const ranked = ACHU_KNOWLEDGE.map((entry) => {
    const phraseScore = entry.phrases.reduce((score, phrase) => {
      const normalizedPhrase = normalize(phrase);
      return normalizedQuestion.includes(normalizedPhrase) ? score + 8 : score;
    }, 0);
    const keywordTerms = new Set(entry.keywords.flatMap(tokens));
    const keywordMatches = [...questionTokens].filter((word) => keywordTerms.has(word)).length;
    const titleTerms = new Set(tokens(entry.title));
    const titleMatches = [...questionTokens].filter((word) => titleTerms.has(word)).length;
    return { entry, score: phraseScore + keywordMatches * 5 + titleMatches * 2 };
  }).sort((left, right) => right.score - left.score);

  return ranked[0]?.score >= 5 ? ranked[0].entry : null;
}

export function getAchuNextStep(pathname: string): AchuHelpEntry {
  if (pathname.startsWith('/company/clients')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'candidates')!;
  if (pathname.startsWith('/company/candidates')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'cases')!;
  if (pathname.startsWith('/company/bgv-cases')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'checks')!;
  if (pathname.startsWith('/company/verifications')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'review')!;
  if (pathname.startsWith('/company/reports')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'invoices')!;
  if (pathname.startsWith('/company/invoices')) return ACHU_KNOWLEDGE.find((entry) => entry.id === 'invoices')!;
  return ACHU_KNOWLEDGE.find((entry) => entry.id === 'start')!;
}
