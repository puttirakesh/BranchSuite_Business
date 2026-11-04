import React from 'react';
import { View, Text } from 'react-native';
import { AppText, Card, Grid } from '../../../shared/components';
import { colors } from '../../../theme/tokens';
import { money } from '../../../shared/utils/format';
import type { PlatformMetrics } from '../api/dashboard.api';

function Bars({ rows }: { rows: { label: string; value: number | null; display: string }[] }) {
  const maximum = Math.max(1, ...rows.map(row => row.value ?? 0));
  return <View style={{ gap: 16, marginTop: 18 }}>{rows.map(row => <View key={row.label} accessibilityLabel={`${row.label}: ${row.display}`}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
      <AppText variant="small">{row.label}</AppText><Text style={{ color: colors.ink, fontWeight: '600' }}>{row.display}</Text>
    </View>
    {row.value != null ? <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, marginTop: 8 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: `${Math.max(0, row.value) / maximum * 100}%` }} /></View> : <AppText variant="tiny">Not reported by the current service</AppText>}
  </View>)}</View>;
}

/** Compare only reported snapshot values; never invent a revenue time series. */
export function PlatformOverview({ metrics: m }: { metrics: PlatformMetrics }) {
  return <Grid columns={{ base: 1, medium: 2 }} gap={16} style={{ marginTop: 20 }}>
    <Card><AppText variant="h2">Revenue overview</AppText><AppText variant="small">INR · recorded totals</AppText><Bars rows={[
      { label: 'Collected to date', value: m.totalPaid, display: money(m.totalPaid) },
      { label: 'Outstanding', value: m.unpaid, display: money(m.unpaid) },
    ]} /></Card>
    <Card><AppText variant="h2">Customer overview</AppText><AppText variant="small">Current platform snapshot</AppText><Bars rows={[
      { label: 'Businesses', value: m.customers, display: m.customers == null ? 'Unavailable' : String(m.customers) },
      { label: 'Active subscriptions', value: m.active, display: m.active == null ? 'Unavailable' : String(m.active) },
      { label: 'Trials', value: m.trials, display: m.trials == null ? 'Unavailable' : String(m.trials) },
    ]} /></Card>
  </Grid>;
}
