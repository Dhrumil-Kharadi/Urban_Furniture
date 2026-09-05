/**
 * Attachments Controller
 */

const attachmentsService = require('./attachments.service');
const { success } = require('../utils/response');

const attachmentsController = {
  async upload(req, res, next) {
    try {
      const data = await attachmentsService.uploadAttachment({
        organizationId: req.user.organization_id,
        actorUserId: req.user.id,
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        file: req.file,
      });
      return success(res, 'Attachment uploaded successfully', data, 201);
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const data = await attachmentsService.listAttachments(
        req.user.organization_id,
        {
          entityType: req.query.entityType,
          entityId: req.query.entityId,
        }
      );
      return success(res, 'Attachments retrieved successfully', data);
    } catch (err) {
      next(err);
    }
  },

  async download(req, res, next) {
    try {
      const fileInfo = await attachmentsService.getAttachmentForDownload(
        req.user.organization_id,
        req.params.id
      );

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileInfo.fileName)}"`
      );
      res.setHeader('Content-Length', fileInfo.fileSize);

      return res.sendFile(fileInfo.filePath);
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const result = await attachmentsService.deleteAttachment(
        req.user.organization_id,
        req.user.id,
        req.params.id
      );
      return success(res, 'Attachment deleted successfully', result);
    } catch (err) {
      next(err);
    }
  },
};

module.exports = attachmentsController;
