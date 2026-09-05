/**
 * Magic Bytes MIME Detector & Validator
 *
 * Inspects binary signatures (magic numbers) in buffers rather than relying on
 * user-declared file extensions or headers.
 * Reference: project.md §9.5 · phase.md Phase 13
 */

function detectMimeByMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // 3. JPEG: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // 4. WEBP: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // 5. ZIP (also used by DOCX, XLSX, etc.): 0x50 0x4B 0x03 0x04 or 0x05 0x06
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return 'application/zip';
  }

  return null;
}

/**
 * Validates whether the buffer's magic bytes match the expected MIME or an allowed MIME.
 * Returns true if valid, false if spoofed or disallowed.
 */
function validateMagicBytes(buffer, declaredMime = null) {
  const detected = detectMimeByMagicBytes(buffer);

  // If detected is null, check if it is pure UTF-8 / ASCII text (e.g. CSV or TXT)
  if (!detected) {
    // Check if declared is text or csv
    const isTextDeclared = declaredMime && (
      declaredMime.startsWith('text/') ||
      declaredMime === 'application/json' ||
      declaredMime === 'text/csv'
    );

    if (isTextDeclared) {
      // Ensure no binary null bytes in the sample
      const sample = buffer.subarray(0, Math.min(buffer.length, 512));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0x00) {
          return { valid: false, reason: 'Binary bytes found in declared text file' };
        }
      }
      return { valid: true, mimeType: declaredMime };
    }

    return { valid: false, reason: 'Unrecognized file format or missing valid magic bytes' };
  }

  // If declared MIME was provided, ensure it doesn't contradict the magic bytes
  if (declaredMime) {
    const normalizedDeclared = declaredMime.toLowerCase().trim();
    if (detected === 'application/pdf' && normalizedDeclared !== 'application/pdf') {
      return { valid: false, reason: `MIME mismatch: declared ${declaredMime} but file is PDF` };
    }
    if (detected === 'image/png' && normalizedDeclared !== 'image/png') {
      return { valid: false, reason: `MIME mismatch: declared ${declaredMime} but file is PNG` };
    }
    if (
      detected === 'image/jpeg' &&
      normalizedDeclared !== 'image/jpeg' &&
      normalizedDeclared !== 'image/jpg'
    ) {
      return { valid: false, reason: `MIME mismatch: declared ${declaredMime} but file is JPEG` };
    }
    if (detected === 'image/webp' && normalizedDeclared !== 'image/webp') {
      return { valid: false, reason: `MIME mismatch: declared ${declaredMime} but file is WebP` };
    }
    if (
      detected === 'application/zip' &&
      !normalizedDeclared.includes('zip') &&
      !normalizedDeclared.includes('openxmlformats') &&
      !normalizedDeclared.includes('officedocument')
    ) {
      return { valid: false, reason: `MIME mismatch: declared ${declaredMime} but file is ZIP/Office archive` };
    }
  }

  return { valid: true, mimeType: detected };
}

module.exports = {
  detectMimeByMagicBytes,
  validateMagicBytes,
};
