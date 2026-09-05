'use strict';

/**
 * fileStorage.js — local disk storage for uploaded files.
 *
 * TECHNICAL RECOMMENDATION. project.md §4.1 requires a Contact profile image
 * and §9.5 anticipates bill attachments, but no storage backend has been
 * decided (§10 has no entry for it). Writing to a local directory keeps the
 * feature working today without inventing a dependency on S3 or similar; the
 * public path is the only thing stored in the database, so swapping in object
 * storage later means changing this file and nothing else.
 *
 * SECURITY
 * - The filename is a random UUID chosen here, never anything the client sent.
 *   A user-supplied name is how path traversal and double-extension tricks get
 *   in, and the original name has no value to this system.
 * - The extension comes from the file's magic bytes (see imageMagic.js), not
 *   from the upload's declared type.
 * - Files are written with restrictive permissions and never executed.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/** Root of the served upload tree. Kept outside src/ so code and data stay apart. */
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

/** Public URL prefix that app.js mounts UPLOAD_ROOT on. */
const PUBLIC_PREFIX = '/uploads';

/**
 * Write a buffer into a namespaced upload folder.
 *
 * @param {string} folder    - Subdirectory, e.g. 'contacts'. Fixed by the
 *                             caller; never derived from a request.
 * @param {Buffer} buffer    - Validated file contents.
 * @param {string} extension - File extension without the dot.
 * @returns {Promise<string>} The public path to store on the record.
 */
async function saveBuffer(folder, buffer, extension) {
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(dir, filename), buffer, { mode: 0o600 });

  return `${PUBLIC_PREFIX}/${folder}/${filename}`;
}

/**
 * Remove a previously stored file, given the public path that was saved on the
 * record. A path that does not resolve inside UPLOAD_ROOT is ignored rather
 * than followed.
 *
 * @param {string|null} publicPath
 * @returns {Promise<boolean>} True when a file was actually removed.
 */
async function deleteByPublicPath(publicPath) {
  if (!publicPath || !publicPath.startsWith(`${PUBLIC_PREFIX}/`)) return false;

  const relative = publicPath.slice(PUBLIC_PREFIX.length + 1);
  const absolute = path.resolve(UPLOAD_ROOT, relative);

  // Containment check — the stored value comes from our own database, but a
  // resolve that escapes the root is exactly the case worth refusing.
  if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return false;

  try {
    await fs.unlink(absolute);
    return true;
  } catch {
    // Already gone, or never written. Nothing to clean up.
    return false;
  }
}

module.exports = { UPLOAD_ROOT, PUBLIC_PREFIX, saveBuffer, deleteByPublicPath };
