/**
 * Attachments Service
 *
 * Implements strict security rules for document attachments:
 * 1. Validate MIME by magic bytes, not declared header.
 * 2. Cap at 5MB (5,242,880 bytes).
 * 3. Store OUTSIDE the web root with generated names.
 * 4. Stream downloads through authorized endpoint — never a public static path.
 * 5. Multi-tenant isolation — no cross-organization access.
 *
 * Reference: project.md §9.5 · technicalrequirement.md §6.13 · phase.md Phase 13
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const attachmentsRepository = require('./attachments.repository');
const { validateMagicBytes } = require('./attachments.magic');
const auditService = require('../shared/audit.service');
const logger = require('../utils/logger');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Storage directory outside web root
const STORAGE_DIR = path.resolve(__dirname, '../../uploads/attachments');

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const attachmentsService = {
  /**
   * Upload and process an attachment.
   *
   * @param {Object} opts
   * @param {string} opts.organizationId
   * @param {string} opts.actorUserId
   * @param {string} opts.entityType (e.g. 'vendor_bill', 'customer_invoice')
   * @param {string} opts.entityId
   * @param {Object} opts.file (Multer file object, memory or temp disk)
   */
  async uploadAttachment({
    organizationId,
    actorUserId,
    entityType,
    entityId,
    file,
  }) {
    if (!file) {
      fail('No file provided', 400);
    }
    if (!entityType || !entityId) {
      fail('Missing entityType or entityId', 400);
    }

    // 1. Cap at 5MB
    const fileSize = file.size || (file.buffer ? file.buffer.length : 0);
    if (fileSize <= 0) {
      fail('File is empty', 400);
    }
    if (fileSize > MAX_FILE_SIZE) {
      fail(`File size ${fileSize} bytes exceeds maximum limit of 5MB`, 400);
    }

    // Read buffer if from disk or memory
    const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      fail('Unable to read file content', 400);
    }

    // 2. Validate MIME by magic bytes
    const validation = validateMagicBytes(buffer, file.mimetype);
    if (!validation.valid) {
      // Remove temp file if existed
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
      fail(`Invalid file content: ${validation.reason}`, 400);
    }

    const verifiedMimeType = validation.mimeType;

    // 3. Generate secure storage filename outside web root
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    const storedFilename = `${organizationId}_${randomHex}${safeExt}`;
    const destinationPath = path.join(STORAGE_DIR, storedFilename);

    // Write file to storage
    fs.writeFileSync(destinationPath, buffer);

    // Clean up multer temp file if any
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }

    // 4. Save metadata to database
    const attachment = await attachmentsRepository.insert(null, {
      organizationId,
      entityType,
      entityId,
      fileName: file.originalname,
      filePath: destinationPath,
      fileSize,
      mimeType: verifiedMimeType,
      createdBy: actorUserId,
    });

    // 5. Record audit log
    await auditService.recordAudit(null, {
      organizationId,
      actorUserId,
      action: 'upload_attachment',
      entityType,
      entityId,
      after: {
        attachmentId: attachment.id,
        fileName: file.originalname,
        fileSize,
        mimeType: verifiedMimeType,
      },
    });

    return attachment;
  },

  /**
   * List attachments for a specific entity.
   */
  async listAttachments(organizationId, { entityType, entityId }) {
    if (!entityType || !entityId) {
      fail('entityType and entityId query parameters are required', 400);
    }
    return attachmentsRepository.listByEntity(null, organizationId, { entityType, entityId });
  },

  /**
   * Stream download an attachment with org isolation check.
   */
  async getAttachmentForDownload(organizationId, attachmentId) {
    const attachment = await attachmentsRepository.findById(null, organizationId, attachmentId);
    if (!attachment) {
      fail('Attachment not found or access denied', 404);
    }

    if (!fs.existsSync(attachment.file_path)) {
      logger.error(`Attachment file missing on disk: ${attachment.file_path}`);
      fail('Attachment file not found on server', 404);
    }

    return {
      filePath: attachment.file_path,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      fileSize: attachment.file_size,
    };
  },

  /**
   * Delete an attachment (Admin only).
   */
  async deleteAttachment(organizationId, actorUserId, attachmentId) {
    const attachment = await attachmentsRepository.findById(null, organizationId, attachmentId);
    if (!attachment) {
      fail('Attachment not found or access denied', 404);
    }

    // Remove from database
    await attachmentsRepository.deleteById(null, organizationId, attachmentId);

    // Remove from disk
    if (fs.existsSync(attachment.file_path)) {
      try {
        fs.unlinkSync(attachment.file_path);
      } catch (err) {
        logger.warn(`Failed to unlink file on disk: ${err.message}`);
      }
    }

    // Record audit
    await auditService.recordAudit(null, {
      organizationId,
      actorUserId,
      action: 'delete_attachment',
      entityType: attachment.entity_type,
      entityId: attachment.entity_id,
      before: {
        attachmentId: attachment.id,
        fileName: attachment.file_name,
      },
    });

    return { success: true, message: 'Attachment deleted successfully' };
  },
};

module.exports = attachmentsService;
