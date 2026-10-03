'use strict';

const express = require('express');

const authRoutes = require('../modules/auth/auth.routes');
const companyRoutes = require('../modules/company/company.routes');
const roleRoutes = require('../modules/role/role.routes');
const permissionRoutes = require('../modules/permission/permission.routes');
const userRoutes = require('../modules/user/user.routes');
const clientRoutes = require('../modules/client/client.routes');
const healthRoutes = require('../modules/health/health.routes');
const contactRoutes = require('../modules/contact/contact.routes');
const auditRoutes = require('../modules/audit/audit.routes');
const platformCandidateRoutes = require('../modules/platform-candidate/platform-candidate.routes');
const platformClientRoutes = require('../modules/platform-client/platform-client.routes');
const platformDashboardRoutes = require('../modules/platform-dashboard/platform-dashboard.routes');
const platformBrandingRoutes = require('../modules/platform-branding/platform-branding.routes');
const platformLocationsRoutes = require('../modules/platform-locations/platform-locations.routes');

const candidateRoutes = require('../modules/candidate/candidate.routes');
const bgvCaseRoutes = require('../modules/bgv-case/bgv-case.routes');
const verificationRoutes = require('../modules/verification/verification.routes');
const invoiceRoutes = require('../modules/invoice/invoice.routes');
const candidatePortalRoutes = require('../modules/candidate-portal/candidate-portal.routes');
const verifierRoutes = require('../modules/verifier/verifier.routes');
const verificationModeRoutes = require('../modules/verification-mode/verification-mode.routes');
const marketingRoutes = require('../modules/marketing/marketing.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

router.use('/companies', companyRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/users', userRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/platform/candidates', platformCandidateRoutes);
router.use('/platform/clients', platformClientRoutes);
router.use('/platform/dashboard', platformDashboardRoutes);
router.use('/platform/branding', platformBrandingRoutes);
router.use('/platform/locations', platformLocationsRoutes);
router.use('/clients', clientRoutes);


// NEW
router.use('/contact', contactRoutes);

router.use('/candidates', candidateRoutes);
router.use('/bgv/cases', bgvCaseRoutes);
router.use('/bgv/verifications', verificationRoutes);
router.use('/bgv/verifiers', verifierRoutes);
router.use('/bgv/verification-modes', verificationModeRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/candidate-portal', candidatePortalRoutes);
router.use('/marketing', marketingRoutes);

module.exports = router;