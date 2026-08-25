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

const candidateRoutes = require('../modules/candidate/candidate.routes');
const bgvCaseRoutes = require('../modules/bgv-case/bgv-case.routes');
const verificationRoutes = require('../modules/verification/verification.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

router.use('/companies', companyRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/users', userRoutes);
router.use('/clients', clientRoutes);


// NEW
router.use('/contact', contactRoutes);

router.use('/candidates', candidateRoutes);
router.use('/bgv/cases', bgvCaseRoutes);
router.use('/bgv/verifications', verificationRoutes);

module.exports = router;