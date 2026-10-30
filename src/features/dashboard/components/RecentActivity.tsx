import { View } from 'react-native';
import AuditLogCard from '../../audit/components/AuditLogCard';
import type { AuditEntry } from '../../../shared/types/common.types';
export default function RecentActivity({ entries }: { entries: AuditEntry[] }) { return <View style={{ gap: 12 }}>{entries.slice(0,10).map(entry=><AuditLogCard key={entry.id} entry={entry} />)}</View>; }
