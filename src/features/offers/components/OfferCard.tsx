import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Offer } from '../types';
export default function Card({ offer }: { offer: Offer }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{offer.code}</Text><Text>{offer.percent + '% discount'}</Text><StatusBadge status={offer.enabled ? 'Active' : 'Suspended'} /></AppCard>; }
