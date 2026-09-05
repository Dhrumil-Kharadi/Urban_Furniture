const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const { withTransaction } = require('../shared/withTransaction');
const authRepository = require('../auth/auth.repository');
const authEmail = require('../auth/auth.email');
const usersRepository = require('./users.repository');

/**
 * Users Service
 *
 * Business logic for organization user administration.
 * Strictly restricted to admin actors.
 */

const usersService = {
  /**
   * List users belonging to an organization.
   *
   * @param {string} organizationId
   * @param {object} query
   * @returns {Promise<{ items: Array, meta: object }>}
   */
  async listUsers(organizationId, query) {
    if (!organizationId) {
      const error = new Error('Organization context required');
      error.statusCode = 403;
      throw error;
    }

    return await usersRepository.listByOrganization(null, organizationId, query);
  },

  /**
   * Invite an Accountant (role='manager') to the organization.
   *
   * Security & spec requirements:
   * - Admin may ONLY create role='manager' (cannot mint another Admin).
   * - Invite token is single-use, hashed at rest (SHA-256), 72-hour expiry.
   * - Initial random password is never returned and never logged.
   * - Identical response whether email already exists or not (enumeration defense).
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {object} params
   * @param {string} params.name
   * @param {string} params.email
   * @returns {Promise<{ user: object }>}
   */
  async inviteUser(organizationId, actorUserId, { name, email }) {
    if (!organizationId) {
      const error = new Error('Organization context required');
      error.statusCode = 403;
      throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if an account with this email already exists
    const existingUser = await authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      // Enumeration defense: Return identical success response without creating duplicate or leaking existence
      return {
        user: {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: 'manager',
          status: 'invited',
        },
      };
    }

    // Generate random 64-char hex invite token
    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // Generate random strong initial password (never logged or exposed)
    const randomInitialPassword = crypto.randomBytes(24).toString('base64');
    const pepperedPassword = randomInitialPassword + env.passwordPepper;
    const passwordHash = await bcrypt.hash(pepperedPassword, env.bcryptRounds);

    let createdUser;
    await withTransaction(async (client) => {
      // Create user as role='manager'
      createdUser = await authRepository.createUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'manager',
        organization_id: organizationId,
        must_change_password: true,
        status: 'invited',
      }, client);

      // Store invite token hash in otp_verifications
      await authRepository.createOtp({
        userId: createdUser.id,
        purpose: 'invite',
        otpHash: tokenHash,
        expiresAt,
      }, client);
    });

    // Send invitation email after transaction commits
    try {
      await authEmail.sendInviteEmail(createdUser.email, rawInviteToken);
    } catch (mailErr) {
      logger.error('Failed to send invite email to user', {
        userId: createdUser.id,
        email: createdUser.email,
        error: mailErr.message,
      });
    }

    return {
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
      },
    };
  },

  /**
   * Activate or deactivate a user in the organization.
   *
   * @param {string} organizationId
   * @param {string} actorUserId
   * @param {string} targetUserId
   * @param {string} status 'active' | 'inactive'
   * @returns {Promise<object>}
   */
  async updateStatus(organizationId, actorUserId, targetUserId, status) {
    if (!organizationId) {
      const error = new Error('Organization context required');
      error.statusCode = 403;
      throw error;
    }

    // Prevent Admin from deactivating own account
    if (actorUserId === targetUserId && status === 'inactive') {
      const error = new Error('Cannot deactivate your own account');
      error.statusCode = 400;
      throw error;
    }

    const existing = await usersRepository.findByIdAndOrg(null, organizationId, targetUserId);
    if (!existing) {
      const error = new Error('User not found in organization');
      error.statusCode = 404;
      throw error;
    }

    const updated = await usersRepository.updateStatus(null, organizationId, targetUserId, status);
    return updated;
  },
};

module.exports = usersService;
