import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Plan } from '../types';
export default function Card({ plan }: { plan: Plan }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{plan.name}</Text><Text>{formatCurrency(plan.monthly) + ' / month'}</Text><StatusBadge status={plan.enabled ? 'Active' : 'Suspended'} /></AppCard>; }
