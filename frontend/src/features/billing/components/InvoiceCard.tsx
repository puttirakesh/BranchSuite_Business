import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Invoice } from '../types';
export default function Card({ invoice }: { invoice: Invoice }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{invoice.id}</Text><Text>{formatCurrency(invoice.amount)}</Text><StatusBadge status={invoice.status} /></AppCard>; }
