import { WorkforceRecord } from './types';

// Local display records; never used for authenticated API results.
export const sampleEmployees: WorkforceRecord[] = [
  { id: 'sample-1', name: 'rizwana', email: 'rizwana@gmail.com', jobTitle: 'HR Manager', department: 'Human Resources', phone: '+91 90000 00001', startDate: '2026-04-01', status: 'ACTIVE' },
  { id: 'sample-2', name: 'kavyasri', email: 'kavyasri@gmail.com', jobTitle: 'Software Engineer', department: 'Engineering', phone: null, startDate: '2026-06-15', status: 'ACTIVE' },
  { id: 'sample-3', name: 'employee', email: 'employee@gmail.com', jobTitle: 'Sales Executive', department: 'Sales', phone: null, startDate: '2026-02-10', status: 'INACTIVE' },
];
