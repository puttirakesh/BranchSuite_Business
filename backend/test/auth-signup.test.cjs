require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { SignupDto } = require('../src/modules/auth/dto/signup.dto');
const { AuthService } = require('../src/modules/auth/auth.service');

const input = {
  emailChallengeId: '11111111-1111-4111-8111-111111111111', emailOtp: '123456',
  businessName: 'Example Business',
  branchName: ' Vijayawada ',
  ownerName: 'Business Owner',
  email: 'owner@example.com',
  phone: '9876543210',
  password: 'test-password',
  planId: 'starter',
  billingCycle: 'monthly',
};

const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validateSignup = (data) =>
  pipe.transform(data, { type: 'body', metatype: SignupDto });

test('signup validation retains and trims the branch name', async () => {
  const dto = await validateSignup({ ...input });
  assert.equal(dto.branchName, 'Vijayawada');
});

test('signup rejects missing and invalid branch names', async () => {
  for (const branchName of [undefined, null, 42, '', '   ', 'A', 'A'.repeat(151), 'Vijay\u0000awada']) {
    await assert.rejects(validateSignup({ ...input, branchName }));
  }
});

test('signup saves the entered branch name and exposes it in the owner session', async () => {
  let branch;
  let company;
  let user;
  const tx = {
    otpChallenge: { updateMany: async () => ({ count: 1 }) },
    tenant: { create: async () => ({ id: 'tenant-id' }) },
    company: { create: async ({ data }) => (company = { id: 'company-id', ...data }) },
    branch: { create: async ({ data }) => (branch = { id: 'branch-id', ...data }) },
    user: { create: async ({ data }) => (user = { id: 'user-id', tokenVersion: 0, ...data }) },
    userRole: { create: async () => ({}) },
    userCompanyAccess: { create: async () => ({}) },
    userBranchAccess: { create: async () => ({}) },
    businessSubscription: { create: async () => ({}) },
  };
  const prisma = {
    role: { findUnique: async () => ({ id: 'owner-role' }) },
    user: {
      findFirst: async () => null,
      findUnique: async () => user ? {
        ...user,
        tenant: { status: 'ACTIVE' },
        roles: [{ role: { name: 'BUSINESS_OWNER', permissions: [] } }],
        companyAccess: [{ company }],
        branchAccess: [{ branch }],
      } : null,
    },
    $transaction: async (callback) => callback(tx),
  };
  const jwt = {
    verifyAsync: async () => ({ sub: 'user-id', tenantId: 'tenant-id', tokenVersion: 0 }),
  };
  const service = new AuthService(prisma, jwt);

  service.checkOtp = async ({ challengeId }) => ({ id: challengeId, channel: 'email', destination: input.email });
  const registration = await service.signup(await validateSignup({ ...input }));
  assert.equal(branch.name, 'Vijayawada');
  assert.equal(registration.business.branchId, branch.id);
  const session = await service.me('Bearer test-token');
  assert.deepEqual(session.memberships[0].branches, [{ id: branch.id, name: 'Vijayawada' }]);
});
