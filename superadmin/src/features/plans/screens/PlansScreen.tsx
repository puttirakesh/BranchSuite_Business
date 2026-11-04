import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../../../theme/tokens';
import { Button, EmptyState, useToast, Grid, Icon, LoadingList, Note, PageHeader, Pill, QueryState, Screen } from '../../../shared/components';
import { usePlans } from '../../../shared/hooks/queries';
import { money } from '../../../shared/utils/format';
import { PlanEditor } from '../components/PlanEditor';
import { featureLabel, PLAN_FEATURES, type Plan } from '../types';

/**
 * APK `platform-plans`: pricing cards with limits and modules.
 * `openEditor` comes from the deep links /plans/create ('new') and /plans/<id>.
 */
export function PlansScreen({ openEditor }: { openEditor?: string } = {}) {
  const plans = usePlans();
  const toast = useToast();
  const [editing, setEditing] = useState<Plan | null | 'new'>(openEditor === 'new' ? 'new' : null);

  useEffect(() => {
    if (!openEditor || openEditor === 'new' || !plans.data) return;
    const found = plans.data.find((p) => p.id === openEditor);
    if (found) setEditing(found);
    else toast('That plan no longer exists.');
  }, [openEditor, plans.data, toast]);

  const close = () => {
    setEditing(null);
    if (openEditor) router.replace('/plans');
  };
  return (
    <Screen onRefresh={plans.refetch}>
      <PageHeader
        title="Plans & limits"
        subtitle="Prices, capacity and available modules."
        action={<Button label="+ Plan" small onPress={() => setEditing('new')} />}
      />
      <QueryState
        query={plans}
        loading={<LoadingList rows={3} height={300} />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="No plans yet" text="Create the first subscription plan so businesses can start a trial." />}
      >
        {(data) => (
          <Grid columns={{ base: 1, medium: 2, sidebar: 3 }} gap={18} style={{ marginBottom: 22 }}>
            {data.map((p, index) => <PriceCard key={p.id} plan={p} featured={index === 1} onEdit={() => setEditing(p)} />)}
          </Grid>
        )}
      </QueryState>
      <Note tone="warning">Existing businesses must fit new limits. A plan edit below their usage is blocked with a clear reason.</Note>
      <PlanEditor visible={editing !== null} plan={editing === 'new' ? null : editing} onClose={close} />
    </Screen>
  );
}

function PriceCard({ plan, featured, onEdit }: { plan: Plan; featured: boolean; onEdit: () => void }) {
  const modules = PLAN_FEATURES.filter((f) => plan.features[f]).map((f) => featureLabel[f]).join(' · ') || 'No modules';
  const rows = [
    plan.limits.employees + ' employees',
    plan.limits.branches + ' branches / ' + plan.limits.companies + ' companies',
    plan.limits.users + ' staff users',
    modules,
  ];
  return (
    <View style={[styles.card, featured ? styles.featured : null]}>
      <View style={styles.between}>
        <Text style={styles.name}>{plan.name}</Text>
        <Pill label={plan.enabled ? 'Active' : 'Disabled'} />
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{money(plan.monthly)}</Text>
        <Text style={styles.per}>/ month</Text>
      </View>
      <Text style={styles.annual}>Annual: {money(plan.annual)} · {plan.trialDays}-day trial</Text>
      <View style={styles.features}>
        {rows.map((r) => (
          <View key={r} style={styles.feature}>
            <Icon name="check" size={13} color="#1E7A58" strokeWidth={2.4} />
            <Text style={styles.featureText}>{r}</Text>
          </View>
        ))}
      </View>
      <Button label="Edit plan & limits" variant={featured ? 'primary' : 'secondary'} full onPress={onEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.price, padding: 23, ...shadow },
  featured: { backgroundColor: '#FAF8FF', borderColor: '#DCD3F2' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', paddingTop: 15, paddingBottom: 7 },
  price: { fontSize: 36, fontWeight: '800', color: '#304463', letterSpacing: -1.2 },
  per: { fontSize: 12, color: colors.subtle, marginLeft: 2 },
  annual: { fontSize: 13, color: colors.muted },
  features: { borderTopWidth: 1, borderTopColor: '#EDF1F6', marginTop: 16, marginBottom: 22 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1F6' },
  featureText: { fontSize: 12, color: '#586D86', flex: 1 },
});
