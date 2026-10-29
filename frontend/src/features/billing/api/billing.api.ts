import { readCollection } from '../../../core/api/client';
export const getBilling = () => readCollection('subscriptionInvoices');
