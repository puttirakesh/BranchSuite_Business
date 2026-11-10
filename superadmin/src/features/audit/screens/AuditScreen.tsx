import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme/tokens';
import { AppText, Card, EmptyState, Grid, ListScreen, PageHeader, SearchBox, DatePickerField, Button, Sheet, DetailList } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useAudit } from '../../../shared/hooks/queries';
import { isValidIsoDate } from '../../../core/domain/dates';

/** APK `platform-audit`, plus action search and date range filters. */
export function AuditScreen() {
  const [selected, setSelected] = useState<import('../types').AuditEvent | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useDebounce(search);
  const audit = useAudit({ search: q, from: isValidIsoDate(from) ? from : undefined, to: isValidIsoDate(to) ? to : undefined, page, limit: 20 });
  const filtered = !!q || !!from || !!to;
  useEffect(() => setPage(1), [q, from, to]);
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Platform audit" subtitle="Subscription, plan and customer-service changes." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Exact action (for example TICKET_REPLIED)" />
          <Grid columns={{ base: 1, medium: 2, sidebar: 4 }} gap={12}>
            <DatePickerField label="From" value={from} onChange={setFrom} maxDate={to || undefined} clearable />
            <DatePickerField label="To" value={to} onChange={setTo} minDate={from || undefined} clearable />
          </Grid>
        </>
      }
      data={audit.data?.items}
      isPending={audit.isPending}
      error={audit.error}
      refetch={audit.refetch}
      footer={<Sheet visible={!!selected} title="Audit event details" onClose={() => setSelected(null)}>{selected ? <DetailList rows={[["Event ID", selected.id], ["Action", selected.action], ["Actor", selected.actor], ["Module", selected.module ?? '?'], ["Date", selected.time], ["Detail", selected.detail]]} /> : null}</Sheet>}
      pagination={audit.data}
      onPageChange={setPage}
      keyOf={(e) => e.id}
      renderItem={(e) => (
        <Card padded={false} style={styles.row}>
          <AppText variant="h3">{e.action}</AppText>
          <Button label="Event details" variant="secondary" small onPress={() => setSelected(e)} />
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
