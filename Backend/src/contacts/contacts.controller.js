const { success, created, error } = require('../utils/response');
const contactsValidation = require('./contacts.validation');
const contactsService = require('./contacts.service');

/**
 * Contacts Controller
 *
 * Reads the request, calls validation, calls the service, responds.
 * No SQL and no business rules live here.
 */

const contactsController = {
  /**
   * GET /api/contacts
   * List contacts with the standard collection contract.
   */
  async listContacts(req, res, next) {
    try {
      const validation = contactsValidation.validateListQuery(req.query);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const result = await contactsService.listContacts(req.organizationId, {
        ...req.query,
        ...validation.data,
      });

      return success(res, 'Contacts retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/contacts/:id
   */
  async getContact(req, res, next) {
    try {
      const contact = await contactsService.getContact(req.organizationId, req.params.id);
      return success(res, 'Contact retrieved successfully', { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/contacts
   */
  async createContact(req, res, next) {
    try {
      const validation = contactsValidation.validateCreate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const contact = await contactsService.createContact({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        actorRole: req.user.role,
        data: validation.data,
        ipAddress: req.ip,
      });

      return created(res, 'Contact created successfully', { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/contacts/:id
   */
  async updateContact(req, res, next) {
    try {
      const validation = contactsValidation.validateUpdate(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const contact = await contactsService.updateContact({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        contactId: req.params.id,
        data: validation.data,
        ipAddress: req.ip,
      });

      return success(res, 'Contact updated successfully', { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/contacts/:id/archive
   */
  async archiveContact(req, res, next) {
    try {
      const contact = await contactsService.archiveContact({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        contactId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Contact archived successfully', { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/contacts/:id/unarchive
   */
  async unarchiveContact(req, res, next) {
    try {
      const contact = await contactsService.unarchiveContact({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        contactId: req.params.id,
        ipAddress: req.ip,
      });

      return success(res, 'Contact restored successfully', { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/contacts/:id/portal-access
   * Body: { enabled: true | false }
   */
  async setPortalAccess(req, res, next) {
    try {
      const validation = contactsValidation.validatePortalAccess(req.body);
      if (!validation.isValid) {
        return error(res, 'Validation failed', 400, validation.errors);
      }

      const contact = await contactsService.setPortalAccess({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        contactId: req.params.id,
        enabled: validation.data.enabled,
        ipAddress: req.ip,
      });

      const message = validation.data.enabled
        ? 'Portal access enabled and invitation sent'
        : 'Portal access revoked';

      return success(res, message, { contact });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/contacts/:id/profile-image
   *
   * The body is the raw image bytes (express.raw), not multipart: the project
   * has no multipart dependency and a single-file upload does not need one.
   */
  async uploadProfileImage(req, res, next) {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return error(res, 'Image file is required', 400);
      }

      const contact = await contactsService.setProfileImage({
        organizationId: req.organizationId,
        actorUserId: req.user.id,
        contactId: req.params.id,
        buffer: req.body,
        declaredMime: req.headers['content-type'],
        ipAddress: req.ip,
      });

      return success(res, 'Profile image updated successfully', { contact });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = contactsController;
