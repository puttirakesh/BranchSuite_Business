import { readCollection } from '../../../core/api/client';
export const getMarketing = () => readCollection('saasLeads');
