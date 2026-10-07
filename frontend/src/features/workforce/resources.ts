import { Field, Resource, ResourceConfig } from './types';

const employee: Field = { key: 'employeeId', label: 'Employee', kind: 'employee', required: true };
const date = (key: string, label: string): Field => ({ key, label, kind: 'date', required: true });
const status: Field = { key: 'status', label: 'Status' };
const amount = (key: string, label: string): Field => ({ key, label, kind: 'money' });

export const resources: Record<Resource, ResourceConfig> = {
  employees: {
    title: 'Employees', singular: 'Employee', description: 'People and employment details in this branch.',
    endpoint: '/employees', permission: 'employees', titleKey: 'name', createLabel: 'Add employee', editable: true,
    fields: [
      { key: 'name', label: 'Full name', required: true, maxLength: 120 },
      { key: 'email', label: 'Email', kind: 'email', required: true, maxLength: 254 },
      { key: 'jobTitle', label: 'Job title', required: true, maxLength: 120 },
      { key: 'department', label: 'Department', required: true, maxLength: 100 },
      { key: 'phone', label: 'Phone', kind: 'phone', maxLength: 30, hint: 'Include the country code for international numbers.' }, date('startDate', 'Start date'),
      { key: 'status', label: 'Status', kind: 'choice', required: true, options: ['ACTIVE', 'INACTIVE'], hint: 'Mark employees inactive when their employment ends.' },
    ], detailFields: [],
  },
  tasks: {
    title: 'Tasks', singular: 'Task', description: 'Assign work and follow progress.',
    endpoint: '/tasks', permission: 'tasks', titleKey: 'title', createLabel: 'Create task', editable: true,
    fields: [
      { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description' },
      { ...employee, key: 'assigneeId', label: 'Assigned to' }, date('dueDate', 'Due date'),
      { key: 'priority', label: 'Priority', kind: 'choice', required: true, options: ['LOW', 'NORMAL', 'HIGH'] },
      { key: 'status', label: 'Status', kind: 'choice', required: true, options: ['TODO', 'IN_PROGRESS', 'DONE'] },
    ], detailFields: [],
  },
  attendance: {
    title: 'Attendance', singular: 'Attendance record', description: 'Daily check-ins, check-outs, and corrections.',
    endpoint: '/attendance', permission: 'attendance', titleKey: 'employeeName', createLabel: 'Record attendance', editable: true,
    fields: [employee, date('date', 'Work date'),
      { key: 'checkIn', label: 'Check-in (with timezone)', kind: 'datetime', required: true },
      { key: 'checkOut', label: 'Check-out (with timezone)', kind: 'datetime' },
      { key: 'notes', label: 'Correction / attendance note' },
    ], detailFields: [status, { key: 'hoursWorked', label: 'Hours worked' }],
  },
  leave: {
    title: 'Leave', singular: 'Leave request', description: 'Request time off and review branch requests.',
    endpoint: '/leave-requests', permission: 'leave', titleKey: 'employeeName', createLabel: 'Request leave',
    fields: [employee,
      { key: 'type', label: 'Leave type', kind: 'choice', required: true, options: ['ANNUAL', 'SICK', 'UNPAID'] },
      date('startDate', 'From'), date('endDate', 'To'), { key: 'reason', label: 'Reason', required: true },
    ], detailFields: [status],
    actions: [
      { label: 'Approve request', path: 'approve', permission: 'leave.approve', allowedStatuses: ['PENDING'] },
      { label: 'Reject request', path: 'reject', permission: 'leave.approve', allowedStatuses: ['PENDING'] },
      { label: 'Cancel request', path: 'cancel', permission: 'leave.cancel', allowedStatuses: ['PENDING'] },
    ],
  },
  payroll: {
    title: 'Payroll', singular: 'Pay run', description: 'Calculate and approve employee salary runs.',
    endpoint: '/payroll/runs', permission: 'payroll', titleKey: 'name', createLabel: 'Create pay run',
    fields: [
      { key: 'name', label: 'Pay run name', required: true }, date('periodStart', 'Period start'), date('periodEnd', 'Period end'),
      { key: 'currency', label: 'Currency (three letters)', required: true },
    ], detailFields: [status, { key: 'employeeCount', label: 'Employees' }, amount('grossPay', 'Gross pay'), amount('deductions', 'Deductions'), amount('netPay', 'Net pay')],
    actions: [
      { label: 'Calculate salaries', path: 'calculate', permission: 'payroll.calculate', allowedStatuses: ['DRAFT'] },
      { label: 'Approve pay run', path: 'approve', permission: 'payroll.approve', allowedStatuses: ['CALCULATED'] },
    ],
  },
  payslips: {
    title: 'Payslips', singular: 'Payslip', description: 'Salary breakdowns and payment status.',
    endpoint: '/payroll/payslips', permission: 'payslips', titleKey: 'employeeName', fields: [],
    detailFields: [employee, status, date('periodStart', 'Period start'), date('periodEnd', 'Period end'),
      amount('basicPay', 'Basic pay'), amount('allowances', 'Allowances'), amount('grossPay', 'Gross pay'),
      amount('deductions', 'Deductions'), amount('netPay', 'Net pay'), { key: 'paymentStatus', label: 'Payment status' },
      { key: 'paidAt', label: 'Paid on', kind: 'datetime' }, { key: 'paymentReference', label: 'Payment reference' },
    ],
  },
};

export function label(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^./, first => first.toUpperCase());
}
