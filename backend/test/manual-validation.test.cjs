require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { CreateUserDto } = require('../src/modules/users/dto/create-user.dto');
const { UpdateUserDto } = require('../src/modules/users/dto/update-user.dto');
const { CreateCustomerDto } = require('../src/modules/crm/dto/create-customer.dto');
const { UpdateCustomerDto } = require('../src/modules/crm/dto/update-customer.dto');
const { CreateLeadDto } = require('../src/modules/crm/dto/create-lead.dto');
const { UpdateLeadDto } = require('../src/modules/crm/dto/update-lead.dto');
const { CreateTaskDto } = require('../src/modules/tasks/dto/task.dto');
const { CreateSupportTicketDto, CreateBillingInvoiceDto } = require('../src/modules/workspace-records/dto/workspace-record.dto');
const errorsFor = async (type, body) => validate(plainToInstance(type, body));

test('user, lead and customer DTOs reject nonnumeric and incomplete phone numbers', async () => {
  for (const type of [CreateUserDto, UpdateUserDto, CreateCustomerDto, UpdateCustomerDto, CreateLeadDto, UpdateLeadDto]) {
    for (const phone of ['123abc', '+919876543210', '12345', '123 4567890']) {
      const errors = await errorsFor(type, { phone });
      assert.ok(errors.some(error => error.property === 'phone'), `${type.name}: ${phone}`);
    }
    const errors = await errorsFor(type, { phone: '9876543210' });
    assert.ok(!errors.some(error => error.property === 'phone'), type.name);
  }
});

test('required text cannot be satisfied with whitespace, including direct API requests', async () => {
  for (const [type, field] of [[CreateUserDto, 'name'], [CreateTaskDto, 'title'], [CreateSupportTicketDto, 'subject']]) {
    const errors = await errorsFor(type, { [field]: '   ' });
    assert.ok(errors.some(error => error.property === field), type.name);
  }
  const task = plainToInstance(CreateTaskDto, { title: '  Meeting notes  ', description: 'Line one\nLine two' });
  assert.equal(task.title, 'Meeting notes');
  assert.ok(!(await validate(task)).some(error => ['title', 'description'].includes(error.property)));
  assert.ok((await errorsFor(CreateTaskDto, { title: 'Bad\u0000title' })).some(error => error.property === 'title'));
});

test('credentials remain unchanged and retain bounded lengths', async () => {
  const password = '  secret password  ';
  assert.equal(plainToInstance(CreateUserDto, { password }).password, password);
  assert.ok((await errorsFor(CreateUserDto, { password: 'x'.repeat(129) })).some(error => error.property === 'password'));
});

test('invoice amounts reject exponent notation, signs and excessive decimal precision', async () => {
  for (const amount of ['1e3', '-10', '10.123', 'Infinity', '9999999999999']) {
    assert.ok((await errorsFor(CreateBillingInvoiceDto, { amount })).some(error => error.property === 'amount'), amount);
  }
  assert.ok(!(await errorsFor(CreateBillingInvoiceDto, { amount: '10.50' })).some(error => error.property === 'amount'));
});


test('every credential DTO rejects blank passwords and preserves nonblank credentials', async () => {
  const { LoginDto } = require('../src/modules/auth/dto/login.dto');
  const { SignupDto } = require('../src/modules/auth/dto/signup.dto');
  const { ResetPasswordDto } = require('../src/modules/auth/dto/reset-password.dto');
  const { OnboardEmployeeDto } = require('../src/modules/employees/dto/employee.dto');
  for (const [type, field] of [[LoginDto, 'password'], [SignupDto, 'password'], [ResetPasswordDto, 'newPassword'], [ResetPasswordDto, 'confirmPassword'], [CreateUserDto, 'password'], [OnboardEmployeeDto, 'password']]) {
    for (const password of [' '.repeat(8), '\u00a0'.repeat(8)]) assert.ok((await errorsFor(type, { [field]: password })).some(error => error.property === field), type.name);
    const password = '  valid password  ';
    assert.equal(plainToInstance(type, { [field]: password })[field], password);
    assert.ok(!(await errorsFor(type, { [field]: password })).some(error => error.property === field), type.name);
  }
});

test('task due dates accept calendar selections and reject impossible dates', async () => {
  const { UpdateTaskDto } = require('../src/modules/tasks/dto/task.dto');
  for (const type of [CreateTaskDto, UpdateTaskDto]) {
    for (const dueDate of ['2026-10-26T23:59:59.000Z', '2028-02-29T23:59:59.000Z', undefined, ...(type === UpdateTaskDto ? [null] : [])]) {
      assert.ok(!(await errorsFor(type, { dueDate })).some(error => error.property === 'dueDate'), String(dueDate));
    }
    for (const dueDate of ['26/10/2026', '2026-02-30T23:59:59.000Z']) assert.ok((await errorsFor(type, { dueDate })).some(error => error.property === 'dueDate'), dueDate);
  }
});

test('onboarding requires positive gross salary and permits zero deductions', async () => {
  const { OnboardEmployeeDto } = require('../src/modules/employees/dto/employee.dto');
  for (const gross of [undefined, '0', '0.00', '-1', '1e3', '0.001']) {
    assert.ok((await errorsFor(OnboardEmployeeDto, { gross })).some(error => error.property === 'gross'), String(gross));
  }
  for (const gross of ['0.01', '100.00']) {
    assert.ok(!(await errorsFor(OnboardEmployeeDto, { gross, deductions: '0' })).some(error => ['gross', 'deductions'].includes(error.property)), gross);
  }
});

test('DTOs trim outer whitespace without removing spaces within words or rewriting passwords', async () => {
  const { OnboardEmployeeDto } = require('../src/modules/employees/dto/employee.dto');
  const { ReviseEmployeeSalaryDto } = require('../src/modules/payroll/dto/payroll.dto');
  const { VerifyOtpDto } = require('../src/modules/auth/dto/otp.dto');
  for (const [type, values] of [
    [CreateUserDto, { name: 'Mary Jane', email: 'mary@example.com', phone: '9876543210' }],
    [OnboardEmployeeDto, { name: 'Mary Jane', email: 'mary@example.com', gross: '100.50', bankIfsc: 'ABCD0123456', pan: 'ABCDE1234F', joiningDate: '2026-10-26' }],
    [ReviseEmployeeSalaryDto, { gross: '100.50', deductions: '0.00', reason: 'Annual review' }],
    [VerifyOtpDto, { otp: '123456' }],
  ]) {
    const padded = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, `  ${value}  `]));
    const dto = plainToInstance(type, padded);
    for (const [key, value] of Object.entries(values)) assert.equal(dto[key], value, `${type.name}.${key}`);
    assert.ok(!(await validate(dto)).some(error => error.property in values), type.name);
  }
  const password = '  valid password  ';
  assert.equal(plainToInstance(CreateUserDto, { password }).password, password);
});

test('name fields require an initial Unicode letter, preserving names with word spaces and punctuation', async () => {
  const { SignupDto } = require('../src/modules/auth/dto/signup.dto');
  const { OnboardEmployeeDto } = require('../src/modules/employees/dto/employee.dto');
  for (const [type, field] of [[CreateUserDto, 'name'], [UpdateUserDto, 'name'], [CreateCustomerDto, 'name'], [SignupDto, 'businessName'], [SignupDto, 'branchName'], [SignupDto, 'ownerName'], [OnboardEmployeeDto, 'name']]) {
    for (const value of ['123 Mary', '_Mary', '.Mary']) assert.ok((await errorsFor(type, { [field]: value })).some(error => error.property === field), `${type.name}: ${value}`);
    for (const value of ['  Mary Jane  ', "O'Connor", '\u00c9lodie', '\u0c2e\u0c23\u0c3f']) assert.ok(!(await errorsFor(type, { [field]: value })).some(error => error.property === field), `${type.name}: ${value}`);
  }
});
