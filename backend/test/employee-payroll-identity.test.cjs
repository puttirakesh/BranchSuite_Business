require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { BadRequestException } = require('@nestjs/common');
const {
  fingerprintEmployeeBankAccount,
  normalizeRequiredEmployeeBankAccountNumber,
  normalizeRequiredEmployeeBankDetails,
  normalizeRequiredEmployeePayrollIdentity,
} = require('../src/modules/employees/payroll-identity');

test('required bank details are trimmed and preserve only a four-digit account ending', () => {
  assert.deepEqual(normalizeRequiredEmployeeBankDetails({
    bankName: ' Test bank ',
    bankBranch: ' Central branch ',
    bankEnding: ' 1234 ',
  }), {
    bankName: 'Test bank',
    bankBranch: 'Central branch',
    bankEnding: '1234',
  });
});

test('missing or malformed required bank details are rejected', () => {
  const valid = { bankName: 'Test bank', bankBranch: 'Central branch', bankEnding: '1234' };
  for (const field of ['bankName', 'bankBranch', 'bankEnding']) {
    assert.throws(() => normalizeRequiredEmployeeBankDetails({ ...valid, [field]: '' }), BadRequestException, field);
  }
  assert.throws(() => normalizeRequiredEmployeeBankDetails({ ...valid, bankEnding: '12A4' }), BadRequestException);
  assert.throws(() => normalizeRequiredEmployeeBankDetails({ ...valid, bankName: 'x'.repeat(101) }), BadRequestException);
  assert.throws(() => normalizeRequiredEmployeeBankDetails({ ...valid, bankBranch: 'x'.repeat(101) }), BadRequestException);
});

test('bank account numbers are validated and fingerprinted without retaining the value', () => {
  const accountNumber = normalizeRequiredEmployeeBankAccountNumber(' 000123456789 ');
  assert.equal(accountNumber, '000123456789');
  for (const value of ['', '12345678', '1234567890123456789', '1234AB789']) {
    assert.throws(() => normalizeRequiredEmployeeBankAccountNumber(value), BadRequestException);
  }

  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
  try {
    const fingerprint = fingerprintEmployeeBankAccount(accountNumber);
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(fingerprintEmployeeBankAccount(accountNumber), fingerprint);
    assert.notEqual(fingerprintEmployeeBankAccount('000123456788'), fingerprint);
    assert.equal(fingerprint.includes(accountNumber), false);
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test('required payroll identifiers are normalized and returned in canonical form', () => {
  assert.deepEqual(normalizeRequiredEmployeePayrollIdentity({
    bankIfsc: ' abcd0123456 ',
    pan: 'abcde1234f',
    uan: '123456789012',
  }), {
    bankIfsc: 'ABCD0123456',
    pan: 'ABCDE1234F',
    uan: '123456789012',
  });
});

test('missing or malformed required payroll identifiers are rejected', () => {
  const valid = { bankIfsc: 'ABCD0123456', pan: 'ABCDE1234F', uan: '123456789012' };
  for (const field of ['bankIfsc', 'pan', 'uan']) {
    const missing = { ...valid, [field]: '' };
    assert.throws(() => normalizeRequiredEmployeePayrollIdentity(missing), BadRequestException, field);
  }
  for (const input of [
    { ...valid, bankIfsc: 'ABCD1123456' },
    { ...valid, pan: 'ABCDE12345' },
    { ...valid, uan: '12345678901A' },
  ]) {
    assert.throws(() => normalizeRequiredEmployeePayrollIdentity(input), BadRequestException);
  }
});
