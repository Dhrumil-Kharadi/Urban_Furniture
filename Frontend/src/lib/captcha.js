// ============================================================
// FILE: src/lib/captcha.js
//
// Locale-safe helpers for the arithmetic CAPTCHA.
//
// The server used to hand the client a finished English sentence — "What is
// 42 + 17?" — which the auth forms then stripped with a regex before showing
// it on a Hindi or Gujarati page. That is a hardcoded English string reaching
// the UI, which strict.md §2 forbids, and it broke the moment the sentence
// changed.
//
// The challenge now arrives as its two operands and an operator, so every
// locale renders the same sum with no words in it at all.
// ============================================================

/** Operator symbols. Mathematical notation, identical in all three locales. */
const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '×': '×' };

/**
 * Render the challenge for display.
 *
 * @param {{ operands?: { a: number, b: number, operator: string }, challenge?: string }} captcha
 * @returns {string} e.g. '42 + 17'
 */
export function formatChallenge(captcha) {
  const operands = captcha?.operands;

  if (operands && Number.isFinite(operands.a) && Number.isFinite(operands.b)) {
    const symbol = OPERATOR_SYMBOLS[operands.operator] || operands.operator;
    return `${operands.a} ${symbol} ${operands.b}`;
  }

  // Fallback for a server that has not been redeployed yet: strip the English
  // prefix as the forms used to. Remove once every environment sends operands.
  return String(captcha?.challenge || '').replace(/^What is\s*/i, '').replace(/\?$/, '');
}

/**
 * Fold Unicode decimal digits onto ASCII so an answer typed on a Devanagari or
 * Gujarati keyboard is the number the server is expecting.
 *
 * The server normalises too — this is the boundary being defensive at both
 * ends, not the client being trusted.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeDigits(value) {
  const isDigit = (codePoint) =>
    codePoint >= 0 && /\p{Nd}/u.test(String.fromCodePoint(codePoint));

  return String(value ?? '').replace(/\p{Nd}/gu, (digit) => {
    const code = digit.codePointAt(0);

    // The run's first member is the one whose predecessor is not a digit, and
    // the distance walked back is the value. Number() is no help here: it
    // returns NaN for '०'.
    for (let offset = 0; offset < 10; offset += 1) {
      if (!isDigit(code - offset)) break;
      if (!isDigit(code - offset - 1)) return String(offset);
    }

    return digit;
  });
}
