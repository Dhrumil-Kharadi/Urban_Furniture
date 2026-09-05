/**
 * Migration: Rename user roles
 *
 * Renames role values to match business terminology:
 *   admin       → business_owner
 *   manager     → accountant
 *   user        → customer
 *   super_admin → removed (converted to business_owner)
 *
 * Adds new 'vendor' role for vendor contacts.
 */

const UP = `
  -- 1. Drop old CHECK constraint
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

  -- 2. Update existing role values
  UPDATE users SET role = 'business_owner' WHERE role = 'admin';
  UPDATE users SET role = 'accountant'     WHERE role = 'manager';
  UPDATE users SET role = 'business_owner' WHERE role = 'super_admin';
  UPDATE users SET role = 'customer'       WHERE role = 'user';

  -- 3. Add new CHECK constraint with updated role values
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('business_owner', 'accountant', 'customer', 'vendor'));

  -- 4. Update default
  ALTER TABLE users ALTER COLUMN role SET DEFAULT 'customer';
`;

const DOWN = `
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

  UPDATE users SET role = 'admin'   WHERE role = 'business_owner';
  UPDATE users SET role = 'manager' WHERE role = 'accountant';
  UPDATE users SET role = 'user'    WHERE role = 'customer';
  UPDATE users SET role = 'user'    WHERE role = 'vendor';

  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('user', 'manager', 'admin', 'super_admin'));

  ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
`;

module.exports = { name: '029_rename_roles', up: UP, down: DOWN };
