import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import StatusBadge from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { Ticket } from '../types';
export default function Card({ ticket }: { ticket: Ticket }) { return <AppCard><Text style={{ fontSize: 18, fontWeight: '700' }}>{ticket.subject}</Text><Text>{ticket.id + ' ? ' + ticket.priority}</Text><StatusBadge status={ticket.status} /></AppCard>; }
