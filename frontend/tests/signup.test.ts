/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, signupApi } from '../src/core/api/client';

test('signup sends the entered branch name to the API', async () => {
  const originalAdapter = api.defaults.adapter;
  let sent: Record<string, unknown> | undefined;
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/auth/signup');
    sent = JSON.parse(config.data);
    return {
      data: { business: { branchId: 'created-branch' } },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    };
  };

  try {
    const result = await signupApi({
      emailChallengeId: '11111111-1111-4111-8111-111111111111', emailOtp: '123456',
      businessName: ' Example Business ',
      branchName: ' Vijayawada ',
      ownerName: ' Business Owner ',
      email: ' OWNER@example.com ',
      phone: ' 9876543210 ',
      password: 'test-password',
      planId: 'starter',
      billingCycle: 'monthly',
    });

    assert.equal(sent?.emailOtp, '123456');
    assert.equal(sent?.branchName, 'Vijayawada');
    assert.equal(result.business.branchId, 'created-branch');
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});

test('signup request accepts a business name starting with a digit', async () => {
  const original = api.defaults.adapter;
  let sent: Record<string, unknown> | undefined;
  api.defaults.adapter = async config => { sent = JSON.parse(config.data); return { data: { business: {} }, status: 201, statusText: 'Created', headers: {}, config }; };
  try {
    await signupApi({ emailChallengeId: '11111111-1111-4111-8111-111111111111', emailOtp: '123456', businessName: '24x7 Mart', branchName: 'Main', ownerName: 'Owner Name',
      email: 'owner@example.com', phone: '9876543210', password: 'password123', planId: 'starter', billingCycle: 'monthly' });
    assert.equal(sent?.businessName, '24x7 Mart');
    await assert.rejects(signupApi({ emailChallengeId: '11111111-1111-4111-8111-111111111111', emailOtp: '123456', businessName: 'Mart', branchName: '1 Main', ownerName: 'Owner',
      email: 'owner@example.com', phone: '9876543210', password: 'password123', planId: 'starter', billingCycle: 'monthly' }));
  } finally { api.defaults.adapter = original; }
});
