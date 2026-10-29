import { Text } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import type { AuditEntry } from '../../../shared/types/common.types';
export default function AuditLogCard({ entry }: { entry: AuditEntry }) { return <AppCard><Text style={{ fontWeight: '700' }}>{entry.action}</Text><Text>{entry.detail}</Text><Text>{entry.actor} ? {entry.time}</Text></AppCard>; }
