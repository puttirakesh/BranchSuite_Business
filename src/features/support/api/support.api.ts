import { readCollection } from '../../../core/api/client';
export const getSupport = () => readCollection('saasTickets');
