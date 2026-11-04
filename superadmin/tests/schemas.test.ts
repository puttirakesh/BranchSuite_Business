import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offerSchema, campaignSchema } from '../src/features/offers/schemas/offer.schema';
import { planSchema } from '../src/features/plans/schemas/plan.schema';
import { subscriptionSchema } from '../src/features/customers/schemas/subscription.schema';
import { followUpSchema } from '../src/features/marketing/schemas/follow-up.schema';
import { settingsSchema } from '../src/features/settings/schemas/settings.schema';
import { replySchema } from '../src/features/support/schemas/reply.schema';
import { loginSchema, resetSchema } from '../src/features/auth/schemas/auth.schema';

const offer = offerSchema(0, '2026-10-31');
test('offer code is upper-cased and validated', () => {
  const ok = offer.safeParse({ code: 'save10', percent: '10', maxUses: '100', expiresOn: '2026-12-31', enabled: true });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.code, 'SAVE10');
  assert.equal(offer.safeParse({ code: 'ab', percent: 10, maxUses: 1, expiresOn: '2026-12-31', enabled: true }).success, false);
});
test('offer percent must be 1-100 and expiry in the future', () => {
  assert.equal(offer.safeParse({ code: 'SAVE', percent: 0, maxUses: 1, expiresOn: '2026-12-31', enabled: true }).success, false);
  assert.equal(offer.safeParse({ code: 'SAVE', percent: 101, maxUses: 1, expiresOn: '2026-12-31', enabled: true }).success, false);
  assert.equal(offer.safeParse({ code: 'SAVE', percent: 5, maxUses: 1, expiresOn: '2026-10-01', enabled: true }).success, false);
});
test('offer usage limit cannot drop below completed uses', () => {
  assert.equal(offerSchema(40, '2026-10-31').safeParse({ code: 'SAVE', percent: 5, maxUses: 30, expiresOn: '2026-12-31', enabled: true }).success, false);
});
test('plan requires whole positive limits and non-negative prices', () => {
  const valid = { name: 'Pro', monthly: '0', annual: 0, employees: 10, branches: 1, companies: 1, users: 1, trialDays: 14, description: '', crm: true, people: true, payroll: false, reports: true, enabled: true };
  assert.equal(planSchema.safeParse(valid).success, true);
  assert.equal(planSchema.safeParse({ ...valid, employees: 0 }).success, false);
  assert.equal(planSchema.safeParse({ ...valid, monthly: -1 }).success, false);
  assert.equal(planSchema.safeParse({ ...valid, users: 1.5 }).success, false);
});
test('subscription dates must be valid ISO dates', () => {
  assert.equal(subscriptionSchema.safeParse({ planId: 'growth', cycle: 'Monthly', status: 'Active', renewOn: '2026-11-01', trialEndsOn: '2026-10-01' }).success, true);
  assert.equal(subscriptionSchema.safeParse({ planId: 'growth', cycle: 'Monthly', status: 'Paused', renewOn: '2026-11-01', trialEndsOn: '2026-10-01' }).success, false);
  assert.equal(subscriptionSchema.safeParse({ planId: 'growth', cycle: 'Monthly', status: 'Active', renewOn: '01/11/2026', trialEndsOn: '2026-10-01' }).success, false);
});
test('campaign, follow-up, settings, reply and auth schemas', () => {
  assert.equal(campaignSchema.safeParse({ name: '', channel: 'Website', offerCode: '', status: 'Draft', notes: '' }).success, false);
  assert.equal(followUpSchema.safeParse({ status: 'Qualified', followup: '2026-11-02', notes: 'Call back' }).success, true);
  assert.equal(settingsSchema.safeParse({ brand: 'B', supportEmail: 'help@x.io', trialEnabled: true }).success, false);
  assert.equal(replySchema.safeParse({ message: '   ', visibility: 'Customer reply', status: 'Open', priority: 'Normal' }).success, false);
  assert.equal(loginSchema.safeParse({ email: ' Admin@Example.com ', password: 'x' }).success, true);
  assert.equal(resetSchema.safeParse({ code: '123456', password: 'abcdefg1', confirm: 'abcdefg2' }).success, false);
});
