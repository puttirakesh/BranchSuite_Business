import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSession } from '../store/session';
import { getDashboard } from '../services/business';
import { errorMessage } from '../services/api';
import { Button, Card, ErrorNotice, StateView, money, styles } from '../components/ui';
import { colors } from '../constants/colors';
import { entityKinds } from '../types';

export default function DashboardScreen() {
  const { scope, membership, can } = useSession();
  const query = useQuery({ queryKey: ['dashboard', scope], queryFn: ({ signal }) => getDashboard(scope!, signal), enabled: !!scope && can('dashboard:read') });
  if (!scope) return <StateView title="No branch assigned" message="Ask your company administrator to assign a branch before opening your workspace." />;
  return <ScrollView refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { if (can('dashboard:read')) void query.refetch(); }} />} contentContainerStyle={styles.content}>
    <View><Text style={styles.muted}>BUSINESS OVERVIEW</Text><Text style={styles.title}>A clear view of your business</Text><Text style={styles.muted}>{membership?.companyName} · Track your relationships and next opportunities.</Text></View>
    {!can('dashboard:read') ? <Card><Text style={styles.muted}>Your membership does not include dashboard access. Open an available CRM module below.</Text></Card> :
      query.isPending ? <StateView loading title="Loading overview…" /> : query.isError ? <StateView title="Overview unavailable" message={errorMessage(query.error)} action="Try again" onAction={() => { void query.refetch(); }} /> : null}
    {query.data && can('dashboard:read') && <>
      {query.isRefetchError && <ErrorNotice message="Could not refresh. These figures are from the last successful request." />}
      <View style={styles.wrap}>{[
        ['Leads', String(query.data.leads), 'Relationships to develop'], ['Customers', String(query.data.customers), 'Your customer base'],
        ['Open deals', String(query.data.openDeals), 'Opportunities in motion'], ['Pipeline value', money(query.data.pipelineValue, query.data.currency), 'Customer sales pipeline'],
      ].map(([label, value, hint]) => <View key={label} style={{ flexGrow: 1, flexBasis: 220 }}><Card><Text style={styles.muted}>{label}</Text><Text style={[styles.title, { color: colors.business }]}>{value}</Text><Text style={styles.muted}>{hint}</Text></Card></View>)}</View>
      <Card><Text style={styles.heading}>Quotes awaiting a response</Text><Text style={styles.title}>{query.data.quotesAwaitingResponse}</Text>{can('quotes:read') && <Button title="View quotes" variant="secondary" onPress={() => router.push('/crm/quotes')} />}</Card>
    </>}
    <View style={{ gap: 12 }}><Text style={styles.heading}>Your CRM workspace</Text><View style={styles.wrap}>{entityKinds.filter((kind) => can(`${kind}:read`)).map((kind) => <Button key={kind} title={`Open ${kind}`} variant="secondary" onPress={() => router.push(`/crm/${kind}`)} />)}</View></View>
    {query.data && can('dashboard:read') && <Card><Text style={styles.heading}>Recent activity</Text>{query.data.recentActivity.length === 0 ? <Text style={styles.muted}>Activity will appear here as your team works.</Text> : query.data.recentActivity.map((activity) => <View key={activity.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 }}><Text style={styles.label}>{activity.title}</Text><Text style={styles.muted}>{activity.description}</Text><Text style={styles.muted}>{new Date(activity.createdAt).toLocaleString()}</Text></View>)}</Card>}
  </ScrollView>;
}
