'use strict';

/**
 * imageMagic.js — image type detection from the file's own bytes.
 *
 * The declared Content-Type on an upload is attacker-controlled. A file can
 * claim image/png and contain a PHP script, an HTML document with a script
 * tag, or a polyglot that a browser will happily execute when the image is
 * served back. The only trustworthy signal is what the first bytes actually
 * are, so that is the only signal used here.
 *
 * Accepted: JPEG, PNG, WebP. Nothing else — no SVG in particular, because SVG
 * is a document format that can carry script.
 */

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

const EXTENSION_BY_MIME = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identify an image buffer by its magic bytes.
 *
 * @param {Buffer} buffer
 * @returns {string|null} One of ALLOWED_MIME_TYPES, or null when unrecognised.
 */
function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG — fixed 8-byte signature.
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';

  // JPEG — SOI marker FF D8 FF. The trailing EOI is not checked: a truncated
  // JPEG is a broken image, not a different file type.
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // WebP — RIFF container whose FourCC at offset 8 is 'WEBP'.
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Validate an uploaded image buffer.
 *
 * Returns the project's standard validation shape so call sites read the same
 * as every other validator in the codebase.
 *
 * @param {Buffer} buffer
 * @param {string} [declaredMime] - The client's claim. Checked only for
 *   agreement with the bytes; it is never trusted on its own.
 * @returns {{ isValid: boolean, errors: string[], data?: { mime: string, extension: string, size: number } }}
 */
function validateImageBuffer(buffer, declaredMime) {
  const errors = [];

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { isValid: false, errors: ['Image file is required'] };
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    errors.push('Image must not exceed 2 MB');
  }

  const actualMime = detectImageMime(buffer);

  if (!actualMime) {
    errors.push('Image must be a JPEG, PNG or WebP file');
  } else if (declaredMime && declaredMime.split(';')[0].trim() !== actualMime) {
    // A mismatch is not a harmless mislabel — it is the signature of a
    // deliberately disguised upload, so it is rejected rather than corrected.
    errors.push('Image content does not match its declared type');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      mime: actualMime,
      extension: EXTENSION_BY_MIME[actualMime],
      size: buffer.length,
    },
  };
}

module.exports = {
  MAX_IMAGE_BYTES,
  ALLOWED_MIME_TYPES,
  detectImageMime,
  validateImageBuffer,
};
