import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Prospect } from '../types';
export default function Card({ prospect }: { prospect: Prospect }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{prospect.business}</Text><Text>{prospect.contact}</Text><StatusBadge status={prospect.status} /></AppCard>; }
