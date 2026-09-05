const organizationsRepository = require('./organizations.repository');

/**
 * Organizations Service
 *
 * Business logic and orchestration for organizations.
 * NEVER touches req or res directly.
 */

/**
 * Convert an organization name into a URL-friendly slug base.
 *
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  const base = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'organization';
}

/**
 * Resolve a unique slug by finding existing slugs and suffixing with -2, -3, etc.
 *
 * @param {object|null} client
 * @param {string} name
 * @returns {Promise<string>}
 */
async function resolveUniqueSlug(client, name) {
  const baseSlug = slugify(name);
  const existingSlugs = await organizationsRepository.findSlugsStartingWith(client, baseSlug);

  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (existingSlugs.includes(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}

const organizationsService = {
  slugify,
  resolveUniqueSlug,

  /**
   * Retrieve the current organization by ID.
   *
   * @param {string} organizationId
   * @returns {Promise<object>}
   */
  async getCurrentOrganization(organizationId) {
    if (!organizationId) {
      const err = new Error('No organization context provided');
      err.statusCode = 403;
      throw err;
    }

    const org = await organizationsRepository.findById(null, organizationId);
    if (!org) {
      const err = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    return org;
  },

  /**
   * Update the current organization settings.
   *
   * @param {string} organizationId
   * @param {object} updateData - { name?, currency_code?, fiscal_year_start_month? }
   * @param {string} userId - ID of the authenticated user making the update
   * @returns {Promise<object>}
   */
  async updateCurrentOrganization(organizationId, updateData, userId) {
    if (!organizationId) {
      const err = new Error('No organization context provided');
      err.statusCode = 403;
      throw err;
    }

    const org = await organizationsRepository.findById(null, organizationId);
    if (!org) {
      const err = new Error('Organization not found');
      err.statusCode = 404;
      throw err;
    }

    const fieldsToUpdate = {
      ...updateData,
      updated_by: userId,
    };

    const updated = await organizationsRepository.update(null, organizationId, fieldsToUpdate);
    return updated;
  },

  /**
   * Create a new organization with slug collision resolution.
   *
   * @param {object|null} client - optional transaction client
   * @param {object} params - { name, currency_code?, fiscal_year_start_month?, created_by? }
   * @returns {Promise<object>}
   */
  async createOrganization(client, { name, currency_code = 'INR', fiscal_year_start_month = 4, created_by = null }) {
    const slug = await resolveUniqueSlug(client, name);
    const org = await organizationsRepository.create(client, {
      name,
      slug,
      currency_code,
      fiscal_year_start_month,
      created_by,
    });
    return org;
  },
};

module.exports = organizationsService;
