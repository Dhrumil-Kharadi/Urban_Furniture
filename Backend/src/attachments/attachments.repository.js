/**
 * Attachments Repository
 * Scoped data access for document attachments.
 * Reference: project.md §9.5 · phase.md Phase 13
 */

const { pool } = require('../config/db');

const attachmentsRepository = {
  /**
   * Insert attachment metadata.
   */
  async insert(client, {
    organizationId,
    entityType,
    entityId,
    fileName,
    filePath,
    fileSize,
    mimeType,
    createdBy,
  }) {
    const db = client || pool;
    const res = await db.query(
      `INSERT INTO attachments (
         organization_id, entity_type, entity_id,
         file_name, file_path, file_size, mime_type, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        organizationId,
        entityType,
        entityId,
        fileName,
        filePath,
        fileSize,
        mimeType,
        createdBy || null,
      ]
    );
    return res.rows[0];
  },

  /**
   * Find attachment by ID with organization boundary enforcement.
   */
  async findById(client, organizationId, id) {
    const db = client || pool;
    const res = await db.query(
      `SELECT * FROM attachments
        WHERE id = $1 AND organization_id = $2`,
      [id, organizationId]
    );
    return res.rows[0] || null;
  },

  /**
   * List attachments for an entity within the organization.
   */
  async listByEntity(client, organizationId, { entityType, entityId }) {
    const db = client || pool;
    const res = await db.query(
      `SELECT a.id, a.organization_id, a.entity_type, a.entity_id,
              a.file_name, a.file_size, a.mime_type, a.created_by, a.created_at,
              u.name AS user_name, u.email AS user_email
         FROM attachments a
         LEFT JOIN users u ON a.created_by = u.id
        WHERE a.organization_id = $1
          AND a.entity_type = $2
          AND a.entity_id = $3
        ORDER BY a.created_at DESC`,
      [organizationId, entityType, entityId]
    );
    return res.rows;
  },

  /**
   * Delete attachment by ID within organization.
   */
  async deleteById(client, organizationId, id) {
    const db = client || pool;
    const res = await db.query(
      `DELETE FROM attachments
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
      [id, organizationId]
    );
    return res.rows[0] || null;
  },
};

module.exports = attachmentsRepository;
