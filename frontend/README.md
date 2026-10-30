This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Copy `.env.example` to `.env.local`. The same-origin `/api/v1` route is proxied
to the backend at `http://127.0.0.1:5000` by default. Set
`NEXT_PUBLIC_API_PROXY_TARGET` in `.env.local` if the backend uses a different
host or port.
Start the backend before starting the frontend so API calls and uploaded assets
can be served through the proxy.

Then run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Client-specific candidate portal forms

Company administrators can open a client and use its **Candidate form** tab to
enable or hide candidate sections, configure identity fields, and upload
client-specific PDF templates such as BGV or PCC forms. BGV templates appear
in their own candidate-portal tab, and forms for additional checks appear under
**Other checks**. Each template can be optional or required; check-specific
categories are filtered against the candidate's selected checks.
Administrators can also enable employment document types per client and mark
each type as required. Candidates choose an enabled document type, such as
salary slip, before attaching the corresponding file.
Administrators can set a client-specific candidate portal link validity from
1 to 30 days. New invitations default to 2 days unless the client selects a
different duration; admins can still choose a custom duration when activating
or extending an individual candidate link.
The Address tab is also configurable per client: administrators can enable
current and permanent address fields, mark either address as required, and
choose which address documents candidates can upload. Options include Aadhaar,
passport, driving licence, voter ID, bank statement, electricity or utility
bill, rent agreement, and a GPS address photo (JPG or PNG). Required address details and uploads are shown on the candidate portal.
Candidates can open and submit consent before a verification case is created
and while they are completing required uploads, until the case is finalized.
Pre-case consent is linked to the case when it is created. Profile edits lock
after consent, but document uploads remain available until the verification
case is completed or cancelled.
Company users can download a formatted candidate form PDF from the candidate
detail page, including submitted profile sections, employment history,
uploaded document status, and recorded consent.

Superadmins can enable or disable the standalone Document Verification page
per company by editing that company's Company Admin role in **Super Admin →
Roles** and granting or removing the **Document Verification: view** permission.
Other company roles can be granted the same permission independently.

Templates are stored outside the public uploads directory and are downloaded
through an authenticated company route or the candidate's active portal link.
Older templates stored under the public uploads tree remain available through
those protected routes, while direct public access to that legacy path returns
404.
The backend needs writable, persistent storage for its
`private-candidate-form-templates` directory. PDF, DOC, and DOCX form templates
are limited to 10 MB; candidate completed-form uploads accept PDF, JPG, or PNG
up to 10 MB.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
