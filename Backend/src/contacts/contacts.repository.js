const { pool } = require('../config/db');
const { parse: parsePagination, buildSort, searchTerm, listResult } = require('../shared/listQuery');

/**
 * Contacts Repository
 *
 * Parameterised SQL only. No HTTP, no business rules.
 *
 * MULTI-TENANCY: every statement in this file filters on organization_id, and
 * every single-row lookup matches on BOTH id and organization_id. A contact
 * belonging to another tenant must be indistinguishable from one that does not
 * exist, so these queries return nothing rather than a row the service would
 * then have to reject.
 */

/**
 * Columns a client may sort by. `sortBy` is mapped through this list and never
 * interpolated from the request — a column name cannot be a bind parameter.
 */
const ALLOWED_SORT_COLUMNS = ['created_at', 'updated_at', 'name', 'contact_type', 'city', 'status'];

/** The public projection. Selected explicitly so a new column is a decision. */
const SELECT_COLUMNS = `
  id, organization_id, name, contact_type, email, mobile,
  city, state, pincode, profile_image_url, portal_access_enabled,
  status, created_by, updated_by, created_at, updated_at
`;

const contactsRepository = {
  /**
   * List contacts in an organization.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {object} [query] - page, limit, search, status, type, sortBy, sortOrder
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async list(client, organizationId, query = {}) {
    const db = client || pool;
    const { page, limit, offset } = parsePagination(query);

    const conditions = ['organization_id = $1'];
    const params = [organizationId];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }

    if (query.type) {
      params.push(query.type);
      conditions.push(`contact_type = $${params.length}`);
    }

    const search = searchTerm(query);
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx} OR mobile ILIKE $${idx} OR city ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::integer AS total FROM contacts ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const orderBy = buildSort(query, ALLOWED_SORT_COLUMNS, 'created_at');

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataRes = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM contacts
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return listResult(dataRes.rows, page, limit, total);
  },

  /**
   * Fetch one contact by id, scoped to the organization.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @returns {Promise<object|null>}
   */
  async findByIdAndOrg(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM contacts
        WHERE id = $1 AND organization_id = $2`,
      [contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find a contact in this organization with the same email, case-insensitively.
   * Used to return a clean 409 instead of a raw unique-index violation.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} email
   * @param {string|null} [excludeId] - Ignore this row (used on update).
   * @returns {Promise<object|null>}
   */
  async findByEmail(client, organizationId, email, excludeId = null) {
    const db = client || pool;
    const params = [organizationId, email];
    let sql = `SELECT id, name, email FROM contacts
                WHERE organization_id = $1 AND lower(email) = lower($2)`;

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id <> $${params.length}`;
    }

    const res = await db.query(`${sql} LIMIT 1`, params);
    return res.rows[0] || null;
  },

  /**
   * Insert a contact.
   *
   * @param {object|null} client
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async insert(client, payload) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO contacts (
         organization_id, name, contact_type, email, mobile,
         city, state, pincode, portal_access_enabled, created_by, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING ${SELECT_COLUMNS}`,
      [
        payload.organization_id,
        payload.name,
        payload.contact_type,
        payload.email,
        payload.mobile,
        payload.city,
        payload.state,
        payload.pincode,
        payload.portal_access_enabled,
        payload.actor_user_id,
      ]
    );
    return res.rows[0];
  },

  /**
   * Update a contact's editable fields.
   *
   * The SET list is assembled from a fixed whitelist of column names, so no
   * request value ever reaches the SQL text — only bind parameters do.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @param {object} fields - Subset of the editable columns.
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async update(client, organizationId, contactId, fields, actorUserId) {
    const db = client || pool;
    const editable = ['name', 'contact_type', 'email', 'mobile', 'city', 'state', 'pincode'];

    const assignments = [];
    const params = [];

    for (const column of editable) {
      if (fields[column] !== undefined) {
        params.push(fields[column]);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    if (assignments.length === 0) {
      return contactsRepository.findByIdAndOrg(db, organizationId, contactId);
    }

    params.push(actorUserId);
    assignments.push(`updated_by = $${params.length}`);
    assignments.push('updated_at = NOW()');

    params.push(contactId);
    const idIdx = params.length;
    params.push(organizationId);
    const orgIdx = params.length;

    const res = await db.query(
      `UPDATE contacts
          SET ${assignments.join(', ')}
        WHERE id = $${idIdx} AND organization_id = $${orgIdx}
        RETURNING ${SELECT_COLUMNS}`,
      params
    );
    return res.rows[0] || null;
  },

  /**
   * Set a contact's status (active / archived).
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @param {string} status
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setStatus(client, organizationId, contactId, status, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE contacts
          SET status = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING ${SELECT_COLUMNS}`,
      [status, actorUserId, contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Set the portal-access flag. Called only from the portal service, inside
   * the same transaction that creates or revokes the login.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @param {boolean} enabled
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setPortalAccess(client, organizationId, contactId, enabled, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE contacts
          SET portal_access_enabled = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING ${SELECT_COLUMNS}`,
      [enabled, actorUserId, contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Store the path of an uploaded profile image.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @param {string|null} imageUrl
   * @param {string} actorUserId
   * @returns {Promise<object|null>}
   */
  async setProfileImage(client, organizationId, contactId, imageUrl, actorUserId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE contacts
          SET profile_image_url = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING ${SELECT_COLUMNS}`,
      [imageUrl, actorUserId, contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find the portal user linked to a contact, scoped to the organization.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} contactId
   * @returns {Promise<object|null>}
   */
  async findPortalUser(client, organizationId, contactId) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, name, email, role, status, token_version, must_change_password,
              email_verified, contact_id, organization_id
         FROM users
        WHERE contact_id = $1 AND organization_id = $2
        LIMIT 1`,
      [contactId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Find any user account already holding this email address.
   *
   * users.email is globally unique (migration 001), so a portal login cannot
   * be minted for an address that is already in use — including by a contact
   * of a different organization. The service turns this into a 409 rather than
   * letting the insert fail with a raw constraint violation.
   *
   * @param {object|null} client
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async findUserByEmailGlobal(client, email) {
    const db = client || pool;
    const res = await db.query(
      `SELECT id, email, role, organization_id, contact_id
         FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email]
    );
    return res.rows[0] || null;
  },

  /**
   * Revoke a portal login.
   *
   * Incrementing token_version invalidates every JWT already issued to this
   * user the moment it is committed — auth.middleware compares the claim to
   * the stored value on every request — so revocation is immediate rather
   * than "within fifteen minutes".
   *
   * The users row itself is RETAINED. Archiving a contact must not erase who
   * did what: audit rows reference this user id (ambiguity A11).
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async revokePortalLogin(client, organizationId, userId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE users
          SET token_version = token_version + 1,
              status = 'inactive',
              updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, email, status, token_version`,
      [userId, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * Delete every refresh token belonging to a user.
   *
   * Deleted rather than flagged revoked: a revoked refresh token still lets
   * the reuse detector fire on a login the operator has deliberately ended.
   *
   * @param {object|null} client
   * @param {string} userId
   * @returns {Promise<number>} Rows removed.
   */
  async deleteRefreshTokens(client, userId) {
    const db = client || pool;
    const res = await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    return res.rowCount || 0;
  },

  /**
   * Re-activate a previously revoked portal login and force a password reset.
   *
   * @param {object|null} client
   * @param {string} organizationId
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async reactivatePortalLogin(client, organizationId, userId) {
    const db = client || pool;
    const res = await db.query(
      `UPDATE users
          SET status = 'invited',
              must_change_password = true,
              token_version = token_version + 1,
              updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, email, status, token_version`,
      [userId, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = contactsRepository;
