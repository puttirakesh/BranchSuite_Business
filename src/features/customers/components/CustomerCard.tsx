import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Customer } from '../types';
export default function Card({ customer }: { customer: Customer }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{customer.name}</Text><Text>{customer.industry}</Text><StatusBadge status={customer.subscription.status} /></AppCard>; }
