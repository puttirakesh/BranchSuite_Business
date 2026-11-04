import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { AppText, Chips, EmptyState, ListScreen, Note, PageHeader, Pill, PressableCard, SearchBox } from '../../../shared/components';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { useProspects } from '../../../shared/hooks/queries';
import { PROSPECT_STAGES, type Prospect } from '../types';

const FILTERS = ['All', ...PROSPECT_STAGES] as const;

/** APK `platform-marketing` (Sales prospects), plus a stage filter. */
export function MarketingScreen() {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<(typeof FILTERS)[number]>('All');
  const q = useDebounce(search);
  const prospects = useProspects({ search: q, limit: 100 });
  const rows = prospects.data?.items.filter((p) => stage === 'All' || p.status === stage);
  return (
    <ListScreen
      header={
        <>
          <PageHeader title="Sales prospects" subtitle="Enquiries from the product page and demo requests." />
          <SearchBox value={search} onChangeText={setSearch} placeholder="Search prospect, industry or stage" />
          <Chips label="Lead stage" options={FILTERS} value={stage} onChange={setStage} />
        </>
      }
      data={rows}
      isPending={prospects.isPending}
      error={prospects.error}
      refetch={prospects.refetch}
      keyOf={(p) => p.id}
      renderItem={(p) => <ProspectRow prospect={p} />}
      empty={q || stage !== 'All' ? <EmptyState title="No prospects match" text="Clear the search or choose another stage." /> : <EmptyState title="No enquiries yet" text="Demo requests from the product page will appear here." />}
      footer={<View style={{ marginTop: 16 }}><Note>Follow-ups are recorded here. This console does not email, message or call prospects.</Note></View>}
    />
  );
}

function ProspectRow({ prospect: l }: { prospect: Prospect }) {
  return (
    <PressableCard onPress={() => router.push(('/marketing/' + encodeURIComponent(l.id)) as never)} accessibilityLabel={l.business + ', ' + l.status}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{l.business}</AppText>
          <AppText variant="small">{l.contact} · {l.industry}</AppText>
        </View>
        <Pill label={l.status} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{l.employees} employees · {l.source}</Text>
        <Text style={styles.metaText}>Follow-up {l.followup}</Text>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F7', marginTop: 16, paddingTop: 14, gap: 10, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: colors.muted },
});
