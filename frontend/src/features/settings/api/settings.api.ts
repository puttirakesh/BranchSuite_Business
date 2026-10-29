import { readCollection } from '../../../core/api/client';
export const getSettings = () => readCollection('platformSettings');
