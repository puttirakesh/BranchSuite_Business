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
