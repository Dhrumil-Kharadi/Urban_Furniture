const express = require('express');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');
const aiController = require('./ai.controller');

const router = express.Router();

router.use(authMiddleware.authenticate, resolveTenant);

router.post(
  '/chat',
  authMiddleware.authorize('business_owner', 'accountant', 'customer', 'vendor'),
  aiController.chat
);

router.post(
  '/predict-comment',
  authMiddleware.authorize('business_owner', 'accountant', 'customer', 'vendor'),
  aiController.predictComment
);

module.exports = router;
