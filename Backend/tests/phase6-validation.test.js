const contactsValidation = require('../src/contacts/contacts.validation');
const productsValidation = require('../src/products/products.validation');
const productCategoriesValidation = require('../src/product-categories/product-categories.validation');
const { detectImageMime, validateImageBuffer, MAX_IMAGE_BYTES } = require('../src/shared/imageMagic');
const { buildSort, toSortParam } = require('../src/shared/listQuery');

/**
 * Phase 6 — pure unit tests.
 *
 * No database, no network. These cover the rules that can be decided from the
 * input alone: field validation, image type detection, and the sort allow-list
 * that is the one place a column name reaches the SQL text.
 */

describe('Phase 6 (unit): contact validation', () => {
  test('accepts a complete contact and normalises the email', () => {
    const result = contactsValidation.validateCreate({
      name: '  Azure Furniture  ',
      contact_type: 'customer',
      email: '  Contact@Azure.COM ',
      mobile: '+91 98765 43210',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
    });

    expect(result.isValid).toBe(true);
    expect(result.data.name).toBe('Azure Furniture');
    expect(result.data.email).toBe('contact@azure.com');
    expect(result.data.pincode).toBe('380015');
  });

  test('rejects a pincode that is not six digits', () => {
    for (const pincode of ['3800', '38001588', 'ABC123', '038001']) {
      const result = contactsValidation.validateCreate({
        name: 'Test Contact', contact_type: 'customer', pincode,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pincode must be 6 digits');
    }
  });

  test('rejects a contact type outside customer / vendor / both', () => {
    const result = contactsValidation.validateCreate({ name: 'Test', contact_type: 'supplier' });
    expect(result.isValid).toBe(false);
  });

  test('portal access defaults on when an email is present and off when it is not', () => {
    const withEmail = contactsValidation.validateCreate({
      name: 'Nimesh Pathak', contact_type: 'vendor', email: 'nimesh@example.com',
    });
    expect(withEmail.data.portal_access_enabled).toBe(true);

    const withoutEmail = contactsValidation.validateCreate({
      name: 'Walk-in Buyer', contact_type: 'customer',
    });
    expect(withoutEmail.data.portal_access_enabled).toBe(false);
  });

  test('an explicit portal_access_enabled:false overrides the email default', () => {
    const result = contactsValidation.validateCreate({
      name: 'One-off Vendor',
      contact_type: 'vendor',
      email: 'oneoff@example.com',
      portal_access_enabled: false,
    });
    expect(result.data.portal_access_enabled).toBe(false);
  });

  test('update never carries the portal flag — that lives on its own endpoint', () => {
    const result = contactsValidation.validateUpdate({
      name: 'Renamed', portal_access_enabled: true,
    });
    expect(result.isValid).toBe(true);
    expect(result.data.portal_access_enabled).toBeUndefined();
  });

  test('an empty update is rejected rather than silently doing nothing', () => {
    const result = contactsValidation.validateUpdate({});
    expect(result.isValid).toBe(false);
  });

  test('portal-access payload requires a real boolean', () => {
    expect(contactsValidation.validatePortalAccess({ enabled: 'true' }).isValid).toBe(false);
    expect(contactsValidation.validatePortalAccess({ enabled: true }).isValid).toBe(true);
  });
});

describe('Phase 6 (unit): product validation', () => {
  test('normalises prices to fixed 2dp strings, never numbers', () => {
    const result = productsValidation.validateCreate({
      name: 'Wooden Chair',
      product_type: 'goods',
      sku: 'wc-001',
      sales_price: '1499.5',
      cost_price: '900',
    });

    expect(result.isValid).toBe(true);
    expect(result.data.sales_price).toBe('1499.50');
    expect(result.data.cost_price).toBe('900.00');
    expect(typeof result.data.sales_price).toBe('string');
    expect(result.data.sku).toBe('WC-001');
  });

  test('rejects negative and non-decimal prices', () => {
    expect(productsValidation.validateCreate({
      name: 'X', product_type: 'goods', sales_price: '-1',
    }).isValid).toBe(false);

    for (const bad of ['1e5', '0x10', 'abc', '1.2.3']) {
      const result = productsValidation.validateCreate({
        name: 'X', product_type: 'goods', sales_price: bad,
      });
      expect(result.isValid).toBe(false);
    }
  });

  test('accepts combo as a type — a label only in v1 (AMBIGUITY A4)', () => {
    const result = productsValidation.validateCreate({ name: 'Dining Set', product_type: 'combo' });
    expect(result.isValid).toBe(true);
    expect(result.data.product_type).toBe('combo');
  });

  test('rejects a reference id that is not a UUID', () => {
    const result = productsValidation.validateCreate({
      name: 'X', product_type: 'goods', category_id: '1 OR 1=1',
    });
    expect(result.isValid).toBe(false);
  });
});

describe('Phase 6 (unit): product category validation', () => {
  test('requires a name between 2 and 100 characters', () => {
    expect(productCategoriesValidation.validateCreate({ name: 'A' }).isValid).toBe(false);
    expect(productCategoriesValidation.validateCreate({ name: 'Seating' }).isValid).toBe(true);
  });
});

describe('Phase 6 (unit): image magic bytes', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const png = Buffer.concat([pngHeader, Buffer.alloc(64)]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('WEBP', 'ascii'), Buffer.alloc(64),
  ]);

  test('identifies jpeg, png and webp from their bytes', () => {
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  test('rejects a file that only claims to be an image', () => {
    const script = Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(64, ' '), 'utf8');
    const result = validateImageBuffer(script, 'image/png');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Image must be a JPEG, PNG or WebP file');
  });

  test('rejects a real image whose declared type disagrees with its bytes', () => {
    const result = validateImageBuffer(png, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Image content does not match its declared type');
  });

  test('rejects an SVG, which is a document format that can carry script', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');
    expect(detectImageMime(svg)).toBeNull();
    expect(validateImageBuffer(svg, 'image/svg+xml').isValid).toBe(false);
  });

  test('rejects anything over 2 MB', () => {
    const oversized = Buffer.concat([pngHeader, Buffer.alloc(MAX_IMAGE_BYTES)]);
    const result = validateImageBuffer(oversized, 'image/png');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Image must not exceed 2 MB');
  });

  test('accepts a well-formed png', () => {
    const result = validateImageBuffer(png, 'image/png');
    expect(result.isValid).toBe(true);
    expect(result.data.extension).toBe('png');
  });
});

describe('Phase 6 (unit): sort allow-list holds against injection', () => {
  const allowed = ['created_at', 'name', 'sales_price'];

  test('an allowed column is honoured in both directions', () => {
    expect(buildSort({ sortBy: 'name' }, allowed, 'created_at')).toBe('"name" ASC');
    expect(buildSort({ sortBy: 'name', sortOrder: 'desc' }, allowed, 'created_at')).toBe('"name" DESC');
  });

  test('an injection attempt falls back to the default column', () => {
    const attacks = [
      'name; DROP TABLE products--',
      'name) OR (SELECT 1',
      '(SELECT password_hash FROM users)',
      'created_at, name',
      "name'--",
    ];

    for (const sortBy of attacks) {
      expect(buildSort({ sortBy }, allowed, 'created_at')).toBe('"created_at" ASC');
    }
  });

  test('an unknown but harmless column also falls back', () => {
    expect(buildSort({ sortBy: 'password_hash' }, allowed, 'created_at')).toBe('"created_at" ASC');
  });

  test('sortOrder is read only as a direction, never as SQL', () => {
    expect(toSortParam({ sortBy: 'name', sortOrder: 'DESC; DROP TABLE users' })).toBe('name');
  });
});
