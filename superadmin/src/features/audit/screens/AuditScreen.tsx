import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/tokens';
import { AppText, Card, EmptyState, Grid, ListScreen, PageHeader, SearchBox, TextField } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useAudit } from '../../../shared/hooks/queries';
import { isValidIsoDate } from '../../../core/domain/dates';

/** APK `platform-audit`, plus action search and date range filters. */
export function AuditScreen() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useDebounce(search);
  const audit = useAudit({ search: q, from: isValidIsoDate(from) ? from : undefined, to: isValidIsoDate(to) ? to : undefined, limit: 100 });
  const filtered = !!q || !!from || !!to;
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Platform audit" subtitle="Subscription, plan and customer-service changes." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search action, detail or person" />
          <Grid columns={{ base: 2, sidebar: 4 }} gap={12}>
            <TextField label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" maxLength={10} error={from && !isValidIsoDate(from) ? 'Use YYYY-MM-DD' : undefined} />
            <TextField label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" maxLength={10} error={to && !isValidIsoDate(to) ? 'Use YYYY-MM-DD' : undefined} />
          </Grid>
        </>
      }
      data={audit.data?.items}
      isPending={audit.isPending}
      error={audit.error}
      refetch={audit.refetch}
      keyOf={(e) => e.id}
      renderItem={(e) => (
        <Card padded={false} style={styles.row}>
          <AppText variant="h3">{e.action}</AppText>
          {e.detail ? <AppText variant="small" style={{ marginTop: 6 }}>{e.detail}</AppText> : null}
          <View style={styles.meta}>
            <Text style={styles.metaText}>{e.actor}{e.module ? ' · ' + e.module : ''}</Text>
            <Text style={styles.metaText}>{e.time}</Text>
          </View>
        </Card>
      )}
      empty={filtered ? <EmptyState title="No events match" text="Clear the search or widen the date range." /> : <EmptyState title="No platform changes yet" text="Plan, subscription, offer and settings changes are recorded here." />}
    />
  );
}

const styles = StyleSheet.create({
  row: { padding: 18 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F7', marginTop: 14, paddingTop: 12, gap: 10 },
  metaText: { fontSize: 11, color: colors.muted },
});
