import { readCollection } from '../../../core/api/client';
export const getCustomers = () => readCollection('tenants');
