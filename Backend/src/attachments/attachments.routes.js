/**
 * Attachments Routes
 * Reference: project.md §9.5 · phase.md Phase 13
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const attachmentsController = require('./attachments.controller');
const authMiddleware = require('../auth/auth.middleware');
const { resolveTenant } = require('../shared/tenant.middleware');

// In-memory buffer storage with 5MB ceiling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB cap
  },
});

router.use(authMiddleware.authenticate, resolveTenant);

// POST /api/attachments (multipart via multer)
router.post(
  '/',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size exceeds maximum allowed limit of 5MB',
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      next();
    });
  },
  attachmentsController.upload
);

// GET /api/attachments?entityType=&entityId=
router.get('/', attachmentsController.list);

// GET /api/attachments/:id/download
router.get('/:id/download', attachmentsController.download);

// DELETE /api/attachments/:id (admin only)
router.delete('/:id', authMiddleware.authorize('business_owner'), attachmentsController.delete);

module.exports = router;
