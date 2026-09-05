const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { CONTACT_STATUS, ROLES } = require('../shared/constants');
const {
  findBlockingReferences,
  CONTACT_REFERENCE_SOURCES,
} = require('../shared/references');
const { validateImageBuffer } = require('../shared/imageMagic');
const fileStorage = require('../shared/fileStorage');
const contactsRepository = require('./contacts.repository');
const contactsPortal = require('./contacts.portal');

/**
 * Contacts Service
 *
 * Business logic and orchestration. Never touches req or res.
 *
 * organizationId always arrives from the caller, which resolved it from
 * req.user — never from a body, query, param or header.
 */

/**
 * Throw a typed error the central error middleware will render.
 * @private
 */
function fail(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

/**
 * Load a contact or fail with 404.
 *
 * A contact belonging to another organization takes this same path: 404, not
 * 403, because a 403 would confirm the record exists and leak the fact that
 * some other tenant holds it.
 * @private
 */
async function loadOrFail(client, organizationId, contactId) {
  const contact = await contactsRepository.findByIdAndOrg(client, organizationId, contactId);
  if (!contact) fail('Contact not found', 404);
  return contact;
}

const contactsService = {
  /**
   * List contacts for an organization.
   *
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async listContacts(organizationId, query) {
    return contactsRepository.list(null, organizationId, query);
  },

  /**
   * Fetch a single contact, including whether a portal login exists for it.
   *
   * @param {string} organizationId
   * @param {string} contactId
   * @returns {Promise<object>}
   */
  async getContact(organizationId, contactId) {
    const contact = await loadOrFail(null, organizationId, contactId);
    const portalUser = await contactsRepository.findPortalUser(null, organizationId, contactId);

    return {
      ...contact,
      // Deliberately narrow: enough for the detail page to show the state of
      // the login, with nothing of the credential itself.
      portal_user: portalUser
        ? {
            id: portalUser.id,
            email: portalUser.email,
            status: portalUser.status,
            must_change_password: portalUser.must_change_password,
            email_verified: portalUser.email_verified,
          }
        : null,
    };
  },

  /**
   * Create a contact, provisioning a portal login when one is wanted.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.actorUserId
   * @param {string} params.actorRole
   * @param {object} params.data - Validated payload.
   * @param {string|null} [params.ipAddress]
   * @returns {Promise<object>}
   */
  async createContact({ organizationId, actorUserId, actorRole, data, ipAddress = null }) {
    if (data.email) {
      const duplicate = await contactsRepository.findByEmail(null, organizationId, data.email);
      if (duplicate) fail('A contact with that email address already exists', 409);
    }

    // Portal provisioning is admin-only (phase.md Phase 6, Security). A manager
    // may create the contact, but may not mint a login as a side effect of
    // doing so, so the flag is forced off and an admin enables it afterwards.
    const wantsPortal = Boolean(data.portal_access_enabled && data.email);
    const provisionNow = wantsPortal && actorRole === ROLES.ADMIN;

    const contact = await withTransaction(async (client) => {
      const created = await contactsRepository.insert(client, {
        organization_id: organizationId,
        name: data.name,
        contact_type: data.contact_type,
        email: data.email,
        mobile: data.mobile,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        // Set by the portal service after the login exists, so the flag and
        // the login can never disagree.
        portal_access_enabled: false,
        actor_user_id: actorUserId,
      });

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'create',
        entityType: 'contact',
        entityId: created.id,
        after: created,
        ipAddress,
      });

      return created;
    });

    if (!provisionNow) return contact;

    const { contact: withPortal } = await contactsPortal.enable({
      organizationId,
      actorUserId,
      contact,
      ipAddress,
    });

    return withPortal;
  },

  /**
   * Update a contact's master-data fields.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async updateContact({ organizationId, actorUserId, contactId, data, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, contactId);

    if (data.email !== undefined && data.email !== null) {
      const duplicate = await contactsRepository.findByEmail(
        null, organizationId, data.email, contactId
      );
      if (duplicate) fail('A contact with that email address already exists', 409);
    }

    // Clearing the email of a portal-enabled contact would leave a login whose
    // password-reset mail has nowhere to go.
    if (data.email === null && existing.portal_access_enabled) {
      fail('Disable portal access before removing this contact\'s email address', 409);
    }

    return withTransaction(async (client) => {
      const updated = await contactsRepository.update(
        client, organizationId, contactId, data, actorUserId
      );
      if (!updated) fail('Contact not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'contact',
        entityId: contactId,
        before: existing,
        after: updated,
        ipAddress,
      });

      return updated;
    });
  },

  /**
   * Archive a contact. Archiving also revokes the portal login — an archived
   * counterparty should not still be able to sign in — while keeping the users
   * row for audit integrity (ambiguity A11).
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async archiveContact({ organizationId, actorUserId, contactId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, contactId);

    if (existing.status === CONTACT_STATUS.ARCHIVED) {
      fail('Contact is already archived', 409);
    }

    const blockers = await findBlockingReferences(
      null, CONTACT_REFERENCE_SOURCES, contactId, organizationId
    );
    if (blockers.length > 0) {
      // Naming the blocker is the difference between an error the operator can
      // act on and one they file a ticket about.
      const detail = blockers.map((b) => `${b.table} (${b.count})`).join(', ');
      fail(`Contact cannot be archived while it is referenced by: ${detail}`, 409);
    }

    return withTransaction(async (client) => {
      if (existing.portal_access_enabled) {
        await contactsPortal.disable({
          organizationId,
          actorUserId,
          contact: existing,
          ipAddress,
          client,
        });
      }

      const archived = await contactsRepository.setStatus(
        client, organizationId, contactId, CONTACT_STATUS.ARCHIVED, actorUserId
      );
      if (!archived) fail('Contact not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'archive',
        entityType: 'contact',
        entityId: contactId,
        before: existing,
        after: archived,
        ipAddress,
      });

      return archived;
    });
  },

  /**
   * Restore an archived contact. Portal access stays off: re-granting a login
   * is a separate, deliberate decision.
   *
   * @param {object} params
   * @returns {Promise<object>}
   */
  async unarchiveContact({ organizationId, actorUserId, contactId, ipAddress = null }) {
    const existing = await loadOrFail(null, organizationId, contactId);

    if (existing.status === CONTACT_STATUS.ACTIVE) {
      fail('Contact is already active', 409);
    }

    return withTransaction(async (client) => {
      const restored = await contactsRepository.setStatus(
        client, organizationId, contactId, CONTACT_STATUS.ACTIVE, actorUserId
      );
      if (!restored) fail('Contact not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'unarchive',
        entityType: 'contact',
        entityId: contactId,
        before: existing,
        after: restored,
        ipAddress,
      });

      return restored;
    });
  },

  /**
   * Enable or disable a contact's portal login. Admin only — enforced on the
   * route, restated here because this is where the consequence lives.
   *
   * @param {object} params
   * @param {boolean} params.enabled
   * @returns {Promise<object>}
   */
  async setPortalAccess({ organizationId, actorUserId, contactId, enabled, ipAddress = null }) {
    const contact = await loadOrFail(null, organizationId, contactId);

    const result = enabled
      ? await contactsPortal.enable({ organizationId, actorUserId, contact, ipAddress })
      : await contactsPortal.disable({ organizationId, actorUserId, contact, ipAddress });

    return result.contact;
  },

  /**
   * Replace a contact's profile image.
   *
   * @param {object} params
   * @param {Buffer} params.buffer      - Raw request body.
   * @param {string} params.declaredMime - The client's Content-Type claim,
   *   cross-checked against the real bytes and otherwise not trusted.
   * @returns {Promise<object>}
   */
  async setProfileImage({
    organizationId, actorUserId, contactId, buffer, declaredMime, ipAddress = null,
  }) {
    const existing = await loadOrFail(null, organizationId, contactId);

    const check = validateImageBuffer(buffer, declaredMime);
    if (!check.isValid) {
      fail(check.errors.join('; '), 400);
    }

    const publicPath = await fileStorage.saveBuffer('contacts', buffer, check.data.extension);

    const updated = await withTransaction(async (client) => {
      const saved = await contactsRepository.setProfileImage(
        client, organizationId, contactId, publicPath, actorUserId
      );
      if (!saved) fail('Contact not found', 404);

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'update',
        entityType: 'contact',
        entityId: contactId,
        before: { profile_image_url: existing.profile_image_url },
        after: { profile_image_url: publicPath },
        ipAddress,
      });

      return saved;
    });

    // Only once the new path is committed is the old file expendable.
    if (existing.profile_image_url) {
      await fileStorage.deleteByPublicPath(existing.profile_image_url);
    }

    return updated;
  },
};

module.exports = contactsService;
