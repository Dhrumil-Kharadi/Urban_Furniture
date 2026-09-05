const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { env } = require('../config/env');
const logger = require('../utils/logger');
const { withTransaction } = require('../shared/withTransaction');
const auditService = require('../shared/audit.service');
const { ROLES } = require('../shared/constants');
const authRepository = require('../auth/auth.repository');
const authEmail = require('../auth/auth.email');
const contactsRepository = require('./contacts.repository');

/**
 * Contact Portal Provisioning
 *
 * project.md §2.1 / §2.2 — turning a Contact master record into a login the
 * customer or vendor can use, and taking that login away again.
 *
 * The two operations are deliberately asymmetric:
 *
 *   ENABLE  is a creation. It needs an email (there is nowhere to send the
 *           invite otherwise), happens in ONE transaction, and only then —
 *           after COMMIT — sends mail. Mail inside a transaction would hold a
 *           connection open on an SMTP round-trip, and a rollback after a
 *           successful send would leave the contact holding a live link to an
 *           account that no longer exists.
 *
 *   DISABLE is a revocation, and revocation must be immediate. Incrementing
 *           token_version kills every JWT already in the wild on its next
 *           request; deleting the refresh tokens stops a new one being minted.
 *           The users row is kept, because audit history points at it.
 *
 * SECURITY: the random initial password is never returned in a response and
 * never written to a log. It exists only so the NOT NULL password_hash column
 * holds something no one can authenticate with; the contact sets a real
 * password through the invite link.
 */

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours, matching the accountant invite

const contactsPortal = {
  /**
   * Enable portal access for a contact.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.actorUserId - Authenticated admin, from req.user.
   * @param {object} params.contact - Already fetched and org-scoped.
   * @param {string|null} [params.ipAddress]
   * @returns {Promise<{ contact: object, portalUserId: string, invited: boolean }>}
   */
  async enable({ organizationId, actorUserId, contact, ipAddress = null }) {
    // 1. Require an email — there is nowhere to send an invite otherwise.
    if (!contact.email) {
      const error = new Error('Contact must have an email address before portal access can be enabled');
      error.statusCode = 400;
      throw error;
    }

    if (contact.status !== 'active') {
      const error = new Error('Portal access cannot be enabled for an archived contact');
      error.statusCode = 409;
      throw error;
    }

    const existingPortalUser = await contactsRepository.findPortalUser(null, organizationId, contact.id);

    // Already provisioned: re-enable the existing login rather than minting a
    // second one. Exactly one users row per contact, always.
    if (existingPortalUser) {
      const rawInviteToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      const updatedContact = await withTransaction(async (client) => {
        await contactsRepository.reactivatePortalLogin(client, organizationId, existingPortalUser.id);
        await authRepository.invalidatePreviousOtps(existingPortalUser.id, 'invite', client);
        await authRepository.createOtp(
          { userId: existingPortalUser.id, purpose: 'invite', otpHash: tokenHash, expiresAt },
          client
        );

        const saved = await contactsRepository.setPortalAccess(
          client, organizationId, contact.id, true, actorUserId
        );

        await auditService.recordAudit(client, {
          organizationId,
          actorUserId,
          action: 'portal_access_enabled',
          entityType: 'contact',
          entityId: contact.id,
          before: { portal_access_enabled: contact.portal_access_enabled },
          after: { portal_access_enabled: true, portal_user_id: existingPortalUser.id },
          ipAddress,
        });

        return saved;
      });

      await sendInvite(existingPortalUser.email, rawInviteToken, contact.id);

      return { contact: updatedContact, portalUserId: existingPortalUser.id, invited: true };
    }

    // users.email is globally unique, so an address already in use anywhere on
    // the platform cannot become this contact's login.
    const emailOwner = await contactsRepository.findUserByEmailGlobal(null, contact.email);
    if (emailOwner) {
      const error = new Error('That email address is already registered to another account');
      error.statusCode = 409;
      throw error;
    }

    // 3. Single-use invite token. Only the SHA-256 hash is stored, so a leaked
    //    database row cannot be replayed as an invite.
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    // A password nobody holds. Never returned, never logged.
    const randomInitialPassword = crypto.randomBytes(24).toString('base64');
    const passwordHash = await bcrypt.hash(randomInitialPassword + env.passwordPepper, env.bcryptRounds);

    let portalUserId;

    // 2. One transaction: the user, the token and the flag land together or
    //    not at all. A contact flagged portal-enabled with no login behind it
    //    is a support ticket nobody can diagnose.
    const updatedContact = await withTransaction(async (client) => {
      const portalUser = await authRepository.createUser(
        {
          name: contact.name,
          email: contact.email,
          passwordHash,
          role: ROLES.USER,
          organization_id: organizationId,
          contact_id: contact.id,
          must_change_password: true,
          status: 'invited',
        },
        client
      );
      portalUserId = portalUser.id;

      await authRepository.createOtp(
        { userId: portalUser.id, purpose: 'invite', otpHash: tokenHash, expiresAt },
        client
      );

      const saved = await contactsRepository.setPortalAccess(
        client, organizationId, contact.id, true, actorUserId
      );

      await auditService.recordAudit(client, {
        organizationId,
        actorUserId,
        action: 'portal_access_enabled',
        entityType: 'contact',
        entityId: contact.id,
        before: { portal_access_enabled: contact.portal_access_enabled },
        after: { portal_access_enabled: true, portal_user_id: portalUser.id },
        ipAddress,
      });

      return saved;
    });

    // 4. COMMIT happened above; only now does anything leave the building.
    await sendInvite(contact.email, rawInviteToken, contact.id);

    return { contact: updatedContact, portalUserId, invited: true };
  },

  /**
   * Disable portal access — this REVOKES the login.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.actorUserId
   * @param {object} params.contact
   * @param {string|null} [params.ipAddress]
   * @param {object|null} [params.client] - Join an in-progress transaction
   *   (contact archiving revokes access as part of the same write).
   * @returns {Promise<{ contact: object, revokedUserId: string|null }>}
   */
  async disable({ organizationId, actorUserId, contact, ipAddress = null, client = null }) {
    const run = async (db) => {
      const portalUser = await contactsRepository.findPortalUser(db, organizationId, contact.id);
      let revokedUserId = null;

      if (portalUser) {
        // Both statements, in this order, are what makes the revocation stick:
        // the version bump invalidates live access tokens, the delete stops a
        // refresh token minting a fresh one.
        await contactsRepository.revokePortalLogin(db, organizationId, portalUser.id);
        await contactsRepository.deleteRefreshTokens(db, portalUser.id);
        await authRepository.invalidatePreviousOtps(portalUser.id, 'invite', db);
        revokedUserId = portalUser.id;
      }

      const saved = await contactsRepository.setPortalAccess(
        db, organizationId, contact.id, false, actorUserId
      );

      await auditService.recordAudit(db, {
        organizationId,
        actorUserId,
        action: 'portal_access_disabled',
        entityType: 'contact',
        entityId: contact.id,
        before: { portal_access_enabled: contact.portal_access_enabled },
        after: { portal_access_enabled: false, revoked_user_id: revokedUserId },
        ipAddress,
      });

      return { contact: saved, revokedUserId };
    };

    return client ? run(client) : withTransaction(run);
  },
};

/**
 * Dispatch the set-password invite.
 *
 * A failed send is logged and swallowed: the account and the token are already
 * committed, so throwing here would report failure for an operation that
 * actually succeeded. The admin can re-send by toggling access again.
 *
 * @private
 */
async function sendInvite(email, rawInviteToken, contactId) {
  try {
    await authEmail.sendInviteEmail(email, rawInviteToken);
  } catch (mailErr) {
    // The token itself is never logged — only that a send failed.
    logger.error('Failed to send portal invite email', {
      contactId,
      recipient: email,
      error: mailErr.message,
    });
  }
}

module.exports = contactsPortal;
