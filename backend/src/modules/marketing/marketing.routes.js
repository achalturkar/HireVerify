'use strict';

const express = require('express');
const multer = require('multer');
const controller = require('./marketing.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/authorize.middleware');
const { BadRequestError } = require('../../utils/errors');

const router = express.Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => file.originalname.toLowerCase().endsWith('.csv')
    ? callback(null, true)
    : callback(new BadRequestError('Upload a .csv file.')),
});
const allowedAttachments = new Set([
  '.pdf', '.txt', '.csv', '.png', '.jpg', '.jpeg',
]);
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fieldSize: 512 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!allowedAttachments.has(extension) || file.originalname.length > 255) {
      return callback(new BadRequestError('Attachments must be named PDF, TXT, CSV, PNG, or JPG files with names no longer than 255 characters.'));
    }
    return callback(null, true);
  },
});

router.post('/unsubscribe', controller.unsubscribe);
router.use(authenticate);
router.get('/settings', authorize('marketing.view'), controller.getSettings);
router.put('/settings', authorize('marketing.manage'), controller.saveSettings);
router.get('/leads', authorize('marketing.view'), controller.listLeads);
router.post('/leads', authorize('marketing.manage'), controller.addLead);
router.post('/leads/import', authorize('marketing.manage'), csvUpload.single('file'), controller.importLeads);
router.post('/direct-mails/recipients/preview', authorize('marketing.send'), csvUpload.single('file'), controller.previewDirectMailRecipients);
router.post('/direct-mails', authorize('marketing.send'), attachmentUpload.array('attachments', 3), controller.sendDirectMail);
router.get('/campaigns', authorize('marketing.view'), controller.listCampaigns);
router.get('/campaigns/:id/recipients', authorize('marketing.view'), controller.listCampaignRecipients);
router.post('/campaigns/test', authorize('marketing.send'), attachmentUpload.array('attachments', 3), controller.sendTest);
router.post('/campaigns', authorize('marketing.send'), attachmentUpload.array('attachments', 3), controller.sendCampaign);

module.exports = router;
