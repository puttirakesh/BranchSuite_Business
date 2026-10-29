import { readCollection } from '../../../core/api/client';
export const getPlans = () => readCollection('plans');
