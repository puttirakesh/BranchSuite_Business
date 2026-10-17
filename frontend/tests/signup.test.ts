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
      businessName: ' Example Business ',
      branchName: ' Vijayawada ',
      ownerName: ' Business Owner ',
      email: ' OWNER@example.com ',
      phone: ' 9876543210 ',
      password: 'test-password',
      planId: 'starter',
      billingCycle: 'monthly',
    });

    assert.equal(sent?.branchName, 'Vijayawada');
    assert.equal(result.business.branchId, 'created-branch');
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});
