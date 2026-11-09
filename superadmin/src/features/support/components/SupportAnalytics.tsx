import React from 'react';
import { Text, View } from 'react-native';
import { Card, ErrorState, Grid, StatCard, Skeleton } from '../../../shared/components';
import { useSupportSummary } from '../../../shared/hooks/support-queries';
import { env } from '../../../core/config/env';

const duration = (ms: number | null) => ms === null ? 'Not available' : `${Math.round(ms / 60000)} min`;
export function SupportAnalytics() {
  const query = useSupportSummary();
  if (env.dataMode !== 'api') return <Card><Text>Advanced analytics require a connected backend.</Text></Card>;
  if (query.isPending) return <Skeleton height={100} />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const s = query.data;
  return <View style={{ gap: 16, marginVertical: 20 }}>
    <Text style={{ fontSize: 20, fontWeight: '700' }}>Support operations</Text>
    <Text>Refreshes every 30 seconds while visible. SLA targets are internal development targets for the initial ticket cycle.</Text>
    <Grid columns={{ base: 2, medium: 3, wide: 4 }} gap={12}>
      {Object.entries({ Total: s.total, Open: s.byStatus.OPEN ?? 0, 'In progress': s.byStatus.IN_PROGRESS ?? 0, Resolved: s.byStatus.RESOLVED ?? 0, Closed: s.byStatus.CLOSED ?? 0, Unassigned: s.unassigned, Assigned: s.assigned, Overdue: s.overdue, Escalated: s.escalated, Unread: s.unread }).map(([label, value]) => <Card key={label}><Text>{label}</Text><Text style={{ fontSize: 24, fontWeight: '700' }}>{value}</Text></Card>)}
    </Grid>
    <Card><Text>Average first public platform response: {duration(s.averageFirstResponseMs)}</Text><Text>Average first resolution: {duration(s.averageResolutionMs)}</Text><Text>Only recorded outcomes are included; legacy untracked outcomes remain unavailable.</Text></Card>
    <Card><Text style={{ fontWeight: '700' }}>Workload by Support agent</Text>{s.workload.map(agent => <Text key={agent.id}>{agent.name} ({agent.status.toLowerCase()}): {agent.assigned} assigned, {agent.open} open</Text>)}{!s.workload.length && <Text>No Support agents.</Text>}</Card>
    <Card><Text style={{ fontWeight: '700' }}>Activity — last 14 UTC calendar days</Text>{s.trend.map(day => <Text key={day.day}>{day.day}: {day.created} created / {day.publicMessages} public messages</Text>)}</Card>
  </View>;
}
