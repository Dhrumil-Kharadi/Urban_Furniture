const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * Auth JWT Utility
 *
 * Exclusively used for contact portal users (role = 'customer' | 'vendor').
 * Privileged users (manager, admin, super_admin) use server-side sessions.
 *
 * Payload:
 * {
 *   sub: user-id (UUID),
 *   role: 'customer',
 *   tokenVersion: integer
 * }
 *
 * Security features:
 * - Short expiration (default 15m)
 * - Minimal claims (no sensitive credentials)
 * - Token version claim enables instant revocation of all issued JWTs upon password reset
 * - Verifies signature, expiration, and required claims
 */

const authJwt = {
  /**
   * Generate a short-lived JWT for a standard user (customer / vendor).
   *
   * @param {Object} user User entity
   * @param {string} user.id User UUID
   * @param {string} user.role Must be 'customer' or 'vendor'
   * @param {number} [user.token_version=1] Current user token version
   * @returns {string} Signed JWT
   */
  generateToken(user) {
    if (!['customer', 'vendor'].includes(user.role)) {
      throw new Error('JWT authentication is restricted to standard users only.');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      tokenVersion: user.token_version !== undefined ? user.token_version : 1,
    };

    const options = {
      expiresIn: env.jwtExpiresIn || '15m',
    };

    return jwt.sign(payload, env.jwtSecret, options);
  },

  /**
   * Verify and decode a JWT.
   *
   * @param {string} token Encoded JWT string
   * @returns {Object} Decoded payload
   * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError}
   */
  verifyToken(token) {
    return jwt.verify(token, env.jwtSecret);
  },
};

module.exports = authJwt;
