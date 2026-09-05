/**
 * Razorpay gateway — signature verification, money conversion, and the rule
 * that the client never names a price.
 *
 * No database, no network. The signature check is the security boundary of
 * the whole integration: it is the only thing standing between "the browser
 * said the payment succeeded" and "the payment actually succeeded".
 *
 * config/env.js snapshots process.env at module load, so the test credentials
 * are set BEFORE the first require of anything that reaches it. Hence the
 * inline requires below rather than a tidy import block at the top.
 */

const TEST_SECRET = 'test-secret-for-signature-verification';
const MAX_ORDER_PAISE = 100000000;

process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
process.env.RAZORPAY_KEY_SECRET = TEST_SECRET;
process.env.RAZORPAY_MAX_ORDER_PAISE = String(MAX_ORDER_PAISE);

const crypto = require('crypto');
/* eslint-disable global-require */
const gatewayValidation = require('../src/gateway/gateway.validation');
const gatewayService = require('../src/gateway/gateway.service');
/* eslint-enable global-require */

const { toPaise, fromPaise } = gatewayService;

/** Produce the signature Razorpay would send for a given order and payment. */
function sign(orderId, paymentId, secret = TEST_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

const ORDER = 'order_MgkQ8vFbA1cDe2';
const PAYMENT = 'pay_MgkQ9wGcB2dEf3';
const INVOICE = '11111111-1111-4111-8111-111111111111';

describe('Razorpay: signature verification', () => {
  test('a genuine signature verifies', () => {
    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, PAYMENT),
    })).toEqual({ verified: true });
  });

  test('a signature made with the WRONG secret is rejected', () => {
    // The attack the check exists for: anyone can call the verify endpoint,
    // but only the secret holder can produce a signature for it.
    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, PAYMENT, 'attacker-guess'),
    })).toEqual({ verified: false });
  });

  test('a signature for a DIFFERENT order is rejected', () => {
    // Replaying a real signature from a ₹1 order onto a ₹50,000 order.
    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign('order_DIFFERENT99999', PAYMENT),
    })).toEqual({ verified: false });
  });

  test('a signature for a DIFFERENT payment is rejected', () => {
    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: sign(ORDER, 'pay_SOMEOTHER'),
    })).toEqual({ verified: false });
  });

  test('the order and payment ids are not interchangeable in the signed string', () => {
    // Signing 'payment|order' must not verify — otherwise the separator is
    // decorative and the hash is over an unordered bag of ids.
    const swapped = crypto.createHmac('sha256', TEST_SECRET)
      .update(`${PAYMENT}|${ORDER}`).digest('hex');

    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: swapped,
    })).toEqual({ verified: false });
  });

  test('a signature of the right length but wrong content is rejected', () => {
    expect(gatewayService.verifyPaymentSignature({
      orderId: ORDER, paymentId: PAYMENT, signature: 'a'.repeat(64),
    })).toEqual({ verified: false });
  });

  test('confirmPayment REFUSES a bad signature with 400, before any lookup', async () => {
    // It must fail on the signature alone — never reaching the gateway, the
    // database, or anything that could record money.
    await expect(
      gatewayService.confirmPayment({
        organizationId: 'org-1',
        actorUserId: 'user-1',
        orderId: ORDER,
        paymentId: PAYMENT,
        signature: sign(ORDER, PAYMENT, 'wrong'),
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('the public config exposes the key id and NEVER the secret', () => {
    const config = gatewayService.getPublicConfig();

    expect(config.keyId).toBe('rzp_test_unit');
    expect(JSON.stringify(config)).not.toContain(TEST_SECRET);
    expect(config.keySecret).toBeUndefined();
    expect(Object.keys(config).sort()).toEqual(['currency', 'keyId']);
  });
});

describe('Razorpay: the client never names a price', () => {
  test('an order request needs only an invoice id', () => {
    const result = gatewayValidation.validateCreateOrder({ invoice_id: INVOICE });
    expect(result.isValid).toBe(true);
    expect(result.data).toEqual({ invoiceId: INVOICE });
  });

  test('an order WITHOUT an invoice is rejected — there is nothing to price', () => {
    expect(gatewayValidation.validateCreateOrder({}).isValid).toBe(false);
  });

  test('★ supplying an amount is REFUSED, not silently ignored', () => {
    // The core of the integration's security. A caller who could set this
    // could pay ₹1 for a ₹50,000 invoice. Refusing loudly also means nobody
    // is left believing they set the price.
    const result = gatewayValidation.validateCreateOrder({
      invoice_id: INVOICE, amount: 100,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/amount cannot be supplied/i);
  });

  test('an amount of zero is refused too — undefined is the only accepted state', () => {
    for (const amount of [0, '0', null, '99999999']) {
      const result = gatewayValidation.validateCreateOrder({ invoice_id: INVOICE, amount });
      expect(result.isValid).toBe(false);
    }
  });

  test('a non-UUID invoice id is rejected', () => {
    for (const invoice_id of ["1' OR '1'='1", 'not-a-uuid', '../../etc/passwd']) {
      expect(gatewayValidation.validateCreateOrder({ invoice_id }).isValid).toBe(false);
    }
  });
});

describe('Razorpay: verify-payment validation', () => {
  const VALID = {
    razorpay_order_id: ORDER,
    razorpay_payment_id: PAYMENT,
    razorpay_signature: sign(ORDER, PAYMENT),
  };

  test('a complete callback passes', () => {
    expect(gatewayValidation.validateVerifyPayment(VALID).isValid).toBe(true);
  });

  test('any missing field is rejected — an unverifiable request is never "probably fine"', () => {
    for (const field of Object.keys(VALID)) {
      const partial = { ...VALID };
      delete partial[field];
      expect(gatewayValidation.validateVerifyPayment(partial).isValid).toBe(false);
    }
  });

  test('a malformed id or signature is rejected before any crypto runs', () => {
    expect(gatewayValidation.validateVerifyPayment({
      ...VALID, razorpay_order_id: 'not-an-order-id',
    }).isValid).toBe(false);

    expect(gatewayValidation.validateVerifyPayment({
      ...VALID, razorpay_signature: 'too-short',
    }).isValid).toBe(false);
  });
});

describe('Razorpay: rupee ↔ paise conversion is exact', () => {
  test('round amounts convert both ways', () => {
    expect(toPaise('1180.00')).toBe(118000);
    expect(fromPaise(118000)).toBe('1180.00');
  });

  test('★ amounts a float would get wrong convert exactly', () => {
    // parseFloat('1180.15') * 100 === 118014.99999999999, which truncates to
    // 118014 — a paisa short on roughly one invoice in a hundred.
    expect(1180.15 * 100).not.toBe(118015);
    expect(toPaise('1180.15')).toBe(118015);

    for (const [rupees, paise] of [
      ['0.01', 1],
      ['0.07', 7],
      ['1.10', 110],
      ['8.29', 829],
      ['33.33', 3333],
      ['1180.15', 118015],
      ['99999.99', 9999999],
    ]) {
      expect(toPaise(rupees)).toBe(paise);
      expect(fromPaise(paise)).toBe(rupees);
    }
  });

  test('a round trip never loses a paisa', () => {
    for (let paise = 1; paise <= 2000; paise += 7) {
      expect(toPaise(fromPaise(paise))).toBe(paise);
    }
  });
});
