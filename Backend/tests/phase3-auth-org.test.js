const { pool } = require('../src/config/db');
const authService = require('../src/auth/auth.service');
const authRepository = require('../src/auth/auth.repository');
const authSession = require('../src/auth/auth.session');
const authEmail = require('../src/auth/auth.email');
const organizationsSeed = require('../src/organizations/organizations.seed');
const usersService = require('../src/users/users.service');
const usersValidation = require('../src/users/users.validation');

jest.setTimeout(20000);

describe('Phase 3: Organization Signup, Seeding & User Invitations', () => {
  const testSuffix = Date.now();
  let createdOrgId;
  let createdAdminUserId;
  let createdAdminEmail;

  beforeAll(() => {
    // Mock email transport to fast resolved promise during automated tests
    jest.spyOn(authEmail, 'sendVerificationEmail').mockResolvedValue(true);
  });

  afterAll(async () => {
    // Clean up test records
    if (createdOrgId) {
      await pool.query('DELETE FROM otp_verifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)', [createdOrgId]);
      await pool.query('DELETE FROM document_sequences WHERE organization_id = $1', [createdOrgId]);
      await pool.query('DELETE FROM journals WHERE organization_id = $1', [createdOrgId]);
      await pool.query('DELETE FROM accounts WHERE organization_id = $1', [createdOrgId]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [createdOrgId]);
      await pool.query('DELETE FROM users WHERE organization_id = $1', [createdOrgId]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [createdOrgId]);
    }
    await pool.end();
  });

  describe('1. Business-Owner Registration & Seeding in ONE Transaction', () => {
    test('Register creates org + admin + full seed (10 accounts, 4 journals, 6 sequences) in ONE transaction', async () => {
      createdAdminEmail = `owner_${testSuffix}@example.com`;
      const orgName = `Urban Living ${testSuffix}`;

      const result = await authService.register({
        name: 'Priya Shah',
        email: createdAdminEmail,
        password: 'Password123!',
        organizationName: orgName,
        role: 'super_admin', // Must be ignored
        organization_id: '00000000-0000-0000-0000-000000000000', // Must be ignored
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('organization');

      expect(result.user.email).toBe(createdAdminEmail);
      expect(result.user.role).toBe('admin'); // Security: forced to admin, ignoring super_admin
      expect(result.organization.name).toBe(orgName);
      expect(result.user.organization_id).toBe(result.organization.id);

      createdOrgId = result.organization.id;
      createdAdminUserId = result.user.id;

      // Verify exact seed counts in database
      const accountsRes = await pool.query(
        'SELECT code, name, account_type, is_system FROM accounts WHERE organization_id = $1 ORDER BY code',
        [createdOrgId]
      );
      expect(accountsRes.rows.length).toBe(10);
      expect(accountsRes.rows.every(r => r.is_system === true)).toBe(true);

      const accountCodes = accountsRes.rows.map(r => r.code);
      expect(accountCodes).toEqual(
        expect.arrayContaining(['1010', '1020', '1030', '1040', '1050', '2010', '2020', '3010', '4010', '5010'])
      );

      const journalsRes = await pool.query(
        'SELECT name, journal_type, sequence_prefix FROM journals WHERE organization_id = $1 ORDER BY name',
        [createdOrgId]
      );
      expect(journalsRes.rows.length).toBe(4);
      const journalTypes = journalsRes.rows.map(r => r.journal_type);
      expect(journalTypes).toEqual(expect.arrayContaining(['sales', 'purchase', 'bank', 'cash']));

      const sequencesRes = await pool.query(
        'SELECT doc_type, prefix, next_number FROM document_sequences WHERE organization_id = $1',
        [createdOrgId]
      );
      expect(sequencesRes.rows.length).toBe(6);
      const docTypes = sequencesRes.rows.map(r => r.doc_type);
      expect(docTypes).toEqual(expect.arrayContaining(['PO', 'SO', 'BILL', 'INV', 'PAY', 'JE']));
    });

    test('A seed failure rolls back the org AND the user — zero orphans', async () => {
      const failSuffix = `${Date.now()}_fail`;
      const failEmail = `fail_owner_${failSuffix}@example.com`;
      const failOrgName = `Fail Org ${failSuffix}`;

      // Temporarily mock seed function to simulate an unexpected error during CoA seeding
      const originalSeed = organizationsSeed.seedOrganizationMasterData;
      organizationsSeed.seedOrganizationMasterData = jest.fn().mockRejectedValue(new Error('Simulated CoA seed failure'));

      await expect(
        authService.register({
          name: 'Failing Owner',
          email: failEmail,
          password: 'Password123!',
          organizationName: failOrgName,
        })
      ).rejects.toThrow('Simulated CoA seed failure');

      // Restore seed function
      organizationsSeed.seedOrganizationMasterData = originalSeed;

      // Verify no orphaned organization or user exists in DB
      const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [failEmail]);
      expect(userCheck.rows.length).toBe(0);

      const orgCheck = await pool.query('SELECT * FROM organizations WHERE name = $1', [failOrgName]);
      expect(orgCheck.rows.length).toBe(0);
    });

    test('A mail failure does NOT roll back the created organization or user', async () => {
      const mailFailSuffix = `${Date.now()}_mailfail`;
      const mailFailEmail = `mailfail_owner_${mailFailSuffix}@example.com`;
      const mailFailOrgName = `MailFail Org ${mailFailSuffix}`;

      // Temporarily mock email sender to throw
      const originalSend = authEmail.sendVerificationEmail;
      authEmail.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('SMTP Transport Network Error'));

      let result;
      try {
        result = await authService.register({
          name: 'MailFail Owner',
          email: mailFailEmail,
          password: 'Password123!',
          organizationName: mailFailOrgName,
        });
      } finally {
        authEmail.sendVerificationEmail = originalSend;
      }

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('organization');

      // Verify the org and user still exist in PostgreSQL
      const userCheck = await pool.query('SELECT id, email, organization_id FROM users WHERE email = $1', [mailFailEmail]);
      expect(userCheck.rows.length).toBe(1);

      const orgCheck = await pool.query('SELECT id, name FROM organizations WHERE id = $1', [result.organization.id]);
      expect(orgCheck.rows.length).toBe(1);

      // Clean up the mailfail test records
      await pool.query('DELETE FROM otp_verifications WHERE user_id = $1', [userCheck.rows[0].id]);
      await pool.query('DELETE FROM document_sequences WHERE organization_id = $1', [result.organization.id]);
      await pool.query('DELETE FROM journals WHERE organization_id = $1', [result.organization.id]);
      await pool.query('DELETE FROM accounts WHERE organization_id = $1', [result.organization.id]);
      await pool.query('UPDATE organizations SET created_by = NULL, updated_by = NULL WHERE id = $1', [result.organization.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [userCheck.rows[0].id]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [result.organization.id]);
    });
  });

  describe('2. User Invitations & Role Escalation Defense', () => {
    let rawInviteToken;
    let invitedUserId;
    const invitedEmail = `accountant_${testSuffix}@example.com`;

    test('/users/invite may only create role="manager" (Admin cannot mint another Admin)', async () => {
      // Validate validation prevents role='admin'
      const invalidValidation = usersValidation.validateInvite({
        name: 'Malicious Admin Clone',
        email: 'malicious@example.com',
        role: 'admin',
      });
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors[0]).toMatch(/Only manager accounts/);

      // Mock email sending to capture the raw token sent to the user
      const originalSendInvite = authEmail.sendInviteEmail;
      authEmail.sendInviteEmail = jest.fn().mockImplementation((to, token) => {
        rawInviteToken = token;
        return Promise.resolve(true);
      });

      let inviteResult;
      try {
        inviteResult = await usersService.inviteUser(createdOrgId, createdAdminUserId, {
          name: 'Rohit Mehta',
          email: invitedEmail,
          role: 'manager',
        });
      } finally {
        authEmail.sendInviteEmail = originalSendInvite;
      }

      expect(inviteResult).toHaveProperty('user');
      expect(inviteResult.user.role).toBe('manager');
      expect(inviteResult.user.status).toBe('invited');
      expect(inviteResult.user.password).toBeUndefined(); // Random password is never returned
      invitedUserId = inviteResult.user.id;

      // Verify user in PostgreSQL
      const userInDb = await pool.query('SELECT role, must_change_password, status FROM users WHERE id = $1', [invitedUserId]);
      expect(userInDb.rows[0].role).toBe('manager');
      expect(userInDb.rows[0].must_change_password).toBe(true);
      expect(userInDb.rows[0].status).toBe('invited');

      // Verify token in otp_verifications is hashed (never plaintext)
      expect(rawInviteToken).toBeDefined();
      expect(rawInviteToken.length).toBe(64);

      const otpInDb = await pool.query(
        'SELECT otp_hash, purpose, used, expires_at FROM otp_verifications WHERE user_id = $1 AND purpose = $2',
        [invitedUserId, 'invite']
      );
      expect(otpInDb.rows.length).toBe(1);
      expect(otpInDb.rows[0].otp_hash).not.toBe(rawInviteToken);
      expect(otpInDb.rows[0].used).toBe(false);
    });

    test('Inviting an existing email returns identical response (enumeration resistance)', async () => {
      const enumResult = await usersService.inviteUser(createdOrgId, createdAdminUserId, {
        name: 'Rohit Duplicate',
        email: invitedEmail,
      });
      expect(enumResult).toHaveProperty('user');
      expect(enumResult.user.email).toBe(invitedEmail);
      expect(enumResult.user.role).toBe('manager');
    });

    test('Invite token is single-use and consumed by /auth/set-password', async () => {
      const newPassword = 'NewSecretPassword123!';

      // Set password using the invite token
      const setResult = await authService.setPassword({
        token: rawInviteToken,
        password: newPassword,
      });

      expect(setResult.message).toMatch(/Password set successfully/);
      expect(setResult.user.status).toBe('active');
      expect(setResult.user.email_verified).toBe(true);

      // Verify token in DB is now marked used = true
      const otpInDb = await pool.query(
        'SELECT used FROM otp_verifications WHERE user_id = $1 AND purpose = $2',
        [invitedUserId, 'invite']
      );
      expect(otpInDb.rows[0].used).toBe(true);

      // Replay attempt must strictly fail
      await expect(
        authService.setPassword({
          token: rawInviteToken,
          password: 'AnotherPassword456!',
        })
      ).rejects.toThrow(/Invalid, expired, or already used/);
    });

    test('Invited user can now log in with the newly set password', async () => {
      const loginResult = await authService.login({
        email: invitedEmail,
        password: 'NewSecretPassword123!',
      });

      expect(loginResult).toBeDefined();
      expect(loginResult.user.email).toBe(invitedEmail);
      expect(loginResult.user.role).toBe('manager');
    });

    test('User status update (activate / deactivate) works and guards against self-deactivation', async () => {
      // Deactivate accountant
      const deactivated = await usersService.updateStatus(createdOrgId, createdAdminUserId, invitedUserId, 'inactive');
      expect(deactivated.status).toBe('inactive');

      // Admin attempting to deactivate own account must be rejected
      await expect(
        usersService.updateStatus(createdOrgId, createdAdminUserId, createdAdminUserId, 'inactive')
      ).rejects.toThrow(/Cannot deactivate your own account/);

      // Reactivate accountant
      const reactivated = await usersService.updateStatus(createdOrgId, createdAdminUserId, invitedUserId, 'active');
      expect(reactivated.status).toBe('active');
    });

    test('Listing org users returns paginated items scoped strictly to the organization', async () => {
      const list = await usersService.listUsers(createdOrgId, { page: 1, limit: 10 });
      expect(list.items.length).toBeGreaterThanOrEqual(2); // Admin + Accountant
      expect(list.items.every(u => u.organization_id === createdOrgId)).toBe(true);
      expect(list.items.every(u => u.password_hash === undefined)).toBe(true);
    });

    test('HTTP: GET /api/auth/me includes the organization object', async () => {
      const request = require('supertest');
      const app = require('../src/app');

      // Ensure admin email is verified for authenticated HTTP access
      await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [createdAdminUserId]);

      // Admin has privileged session cookie
      const adminSession = authSession.createSession(createdAdminUserId, 'admin', false);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`sid=${adminSession.sessionId}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(createdAdminUserId);
      expect(res.body.data.organization).toBeDefined();
      expect(res.body.data.organization.id).toBe(createdOrgId);
      expect(res.body.data.organization.name).toContain('Urban Living');
    });

    test('HTTP: manager calling /api/users/invite receives 403 Forbidden', async () => {
      const request = require('supertest');
      const app = require('../src/app');

      // Manager has privileged session cookie
      const managerSession = authSession.createSession(invitedUserId, 'manager', false);
      const res = await request(app)
        .post('/api/users/invite')
        .set('Cookie', [`sid=${managerSession.sessionId}`])
        .send({
          name: 'Unauthorized User',
          email: 'unauth@example.com',
          role: 'manager',
        });

      expect(res.status).toBe(403);
    });

    test('HTTP: admin calling /api/users/invite creates user with role="manager"', async () => {
      const request = require('supertest');
      const app = require('../src/app');

      const adminSession = authSession.createSession(createdAdminUserId, 'admin', false);
      const res = await request(app)
        .post('/api/users/invite')
        .set('Cookie', [`sid=${adminSession.sessionId}`])
        .send({
          name: 'Second Accountant',
          email: `second_${Date.now()}@example.com`,
          role: 'manager',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('manager');
      expect(res.body.data.user.status).toBe('invited');
    });
  });
});
