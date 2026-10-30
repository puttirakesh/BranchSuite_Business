import { readCollection } from '../../../core/api/client';
export const getAudit = () => readCollection('saasAudit');
