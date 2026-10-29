import { readCollection } from '../../../core/api/client';
export const getOffers = () => readCollection('coupons');
