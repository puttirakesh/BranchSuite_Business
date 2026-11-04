import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadow } from '../../../theme/tokens';
import {
  AppText, Button, Card, EmptyState, ErrorState, Grid, Icon, LoadingList, ModuleCard, QuickAction, Screen, SectionTitle, Skeleton, StatCard, Tile,
} from '../../../shared/components';
import { useCustomers, useMetrics, usePlans } from '../../../shared/hooks/queries';
import { useAuth } from '../../../core/auth/AuthContext';
import { can } from '../../../core/permissions/roles';
import { env } from '../../../core/config/env';
import { needsAttention, type SubscriptionState } from '../../../core/domain/subscription';
import { businessDate } from '../../../core/domain/clock';
import { useBreakpoint } from '../../../shared/hooks/useBreakpoint';
import { useQuickAction } from '../../../shared/components/QuickActions';
import { money, shortDate } from '../../../shared/utils/format';
import { CustomerCard } from '../../customers/components/CustomerCard';
import { customerStatus } from '../../customers/utils/customer-status';

const go = (href: string) => router.push(href as never);
const n = (v: number | null | undefined) => (v == null ? '—' : String(v));

/** APK v2.3 admin home (workspace-ui.js `adminHome`). */
export function AdminDashboardScreen() {
  const { user } = useAuth();
  const role = user?.role;
  const owner = role === 'PLATFORM_ADMIN';
  const metrics = useMetrics();
  const customers = useCustomers({ limit: 12 });
  const plans = usePlans();
  const quick = useQuickAction();
  const { sidebar } = useBreakpoint();
  const m = metrics.data;
  const date = shortDate(businessDate()).split(' ');

  const attention = (customers.data?.items ?? []).filter((c) => needsAttention(customerStatus(c) as SubscriptionState));

  return (
    <Screen onRefresh={() => Promise.all([metrics.refetch(), customers.refetch()])}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <AppText variant="eyebrow" style={{ fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>BranchSuite admin</AppText>
          <AppText variant="homeH1" accessibilityRole="header">{owner ? 'Your platform' : 'Customer support'}</AppText>
          <AppText variant="body" color={colors.muted} style={{ marginTop: 7 }}>A clear view of your subscription business.</AppText>
        </View>
        <View style={styles.date}>
          <Icon name="attendance" size={15} color="#586C89" />
          <View>
            <Text style={styles.dateMain}>{date[0]} {date[1]}</Text>
            <Text style={styles.dateSub}>{env.dataMode === 'preview' ? 'Sample day' : 'Today'}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.quickbar, sidebar ? styles.quickbarWide : null]}>
        <QuickAction label="Customers" icon="building" tone="blue" onPress={() => go('/customers')} />
        {can(role, 'offers.manage') ? <QuickAction label="New offer" icon="star" tone="lavender" onPress={() => quick('offer')} /> : null}
        {can(role, 'offers.manage') ? <QuickAction label="Campaign" icon="leads" tone="mint" onPress={() => quick('campaign')} /> : null}
        <QuickAction label="Support" icon="support" tone={owner ? 'amber' : 'mint'} onPress={() => go('/support')} />
      </View>

      <View style={styles.sectionLabel}>
        <AppText variant="h2">Business health</AppText>
        <AppText variant="tiny">{env.dataMode === 'preview' ? 'Preview subscriptions' : 'Live subscriptions'}</AppText>
      </View>
      {metrics.isPending ? (
        <Grid columns={{ base: 2, sidebar: 4 }} gap={14}>{[0, 1, 2, 3].map((k) => <Skeleton key={k} height={140} />)}</Grid>
      ) : metrics.error ? (
        <ErrorState compact error={metrics.error} onRetry={() => void metrics.refetch()} />
      ) : (
        <Grid columns={{ base: 2, sidebar: 4 }} gap={14}>
          <StatCard label="Businesses" value={n(m?.customers)} hint={m?.active != null ? m.active + ' active' + (m.trials != null ? ' · ' + m.trials + ' trial' : '') : 'Customer workspaces'} icon="building" tone="blue" onPress={() => go('/customers')} />
          <StatCard label="Need attention" value={n(m?.attention)} hint={m?.attention == null ? 'Not reported by the backend yet' : 'Review subscription status'} icon="approvals" tone="amber" onPress={() => go('/customers')} />
          {owner ? (
            <StatCard label="Monthly recurring" value={m?.monthlyRecurring != null ? money(m.monthlyRecurring) : '—'} hint={m?.monthlyRecurring != null ? 'Monthly equivalent' : 'Not reported by the backend yet'} icon="wallet" tone="mint" onPress={() => go('/billing')} />
          ) : (
            <StatCard label="Open support" value={n(m?.openSupport)} hint="Customer enquiries" icon="support" tone="mint" onPress={() => go('/support')} />
          )}
          {owner ? (
            <StatCard label="Unpaid invoices" value={m?.unpaid != null ? money(m.unpaid) : '—'} hint={m?.unpaid != null ? 'Outstanding' : m?.totalPaid != null ? money(m.totalPaid) + ' paid to date' : 'Not reported yet'} icon="quote" tone="lavender" onPress={() => go('/billing')} />
          ) : (
            <StatCard label="Trial workspaces" value={n(m?.trials)} hint="Help them get started" icon="star" tone="lavender" onPress={() => go('/customers')} />
          )}
        </Grid>
      )}

      <View style={[styles.columns, sidebar ? styles.columnsWide : null]}>
        <View style={sidebar ? { flexGrow: 1.55, flexShrink: 1, flexBasis: 0, minWidth: 0 } : null}>
          <SectionTitle title="Manage your platform" />
          <Grid columns={{ base: 2 }} gap={14}>
            {[
              <ModuleCard key="c" label="Customers" description="Businesses & subscriptions" icon="building" tone="blue" count={m?.customers != null ? m.customers + ' businesses' : undefined} onPress={() => go('/customers')} />,
              can(role, 'plans.manage') && <ModuleCard key="p" label="Plans & limits" description="Pricing, seats & features" icon="wallet" tone="lavender" count={m?.plans != null ? m.plans + ' plans' : undefined} onPress={() => go('/plans')} />,
              can(role, 'billing.view') && <ModuleCard key="b" label="Billing" description="Invoices & collections" icon="quote" tone="mint" onPress={() => go('/billing')} />,
              can(role, 'marketing.manage') && <ModuleCard key="m" label="Marketing" description="Prospects & follow-ups" icon="leads" tone="amber" count={m?.openProspects != null ? m.openProspects + ' prospects' : undefined} onPress={() => go('/marketing')} />,
              can(role, 'offers.manage') && <ModuleCard key="o" label="Offers" description="Coupons & campaigns" icon="star" tone="lavender" onPress={() => go('/offers')} />,
              <ModuleCard key="s" label="Support" description="Enquiries & resolutions" icon="support" tone="blue" count={m?.openSupport != null ? m.openSupport + ' open' : undefined} onPress={() => go('/support')} />,
            ].filter(Boolean)}
          </Grid>
        </View>
        <View style={sidebar ? { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 } : null}>
          <SectionTitle title="Priority queue" />
          {attention.map((c) => (
            <Tile key={c.id} title={c.name} description={customerStatus(c) + ' · subscription review'} icon="building" tone="amber" onPress={() => go('/customers/' + c.id)} />
          ))}
          {m?.openSupport ? <Tile title={m.openSupport + ' support requests'} description="Help customers get back to work" icon="support" tone="blue" onPress={() => go('/support')} /> : null}
          {owner && m?.openProspects ? <Tile title={m.openProspects + ' open prospects'} description="Review your next opportunity" icon="leads" tone="mint" onPress={() => go('/marketing')} /> : null}
          {!attention.length && !m?.openSupport && !(owner && m?.openProspects) && !metrics.isPending ? (
            <EmptyState title="All caught up" text="New customer activity will appear here." />
          ) : null}
        </View>
      </View>

      <SectionTitle title="Customer health" action={<Button label="View all" variant="text" small onPress={() => go('/customers')} />} />
      {customers.isPending ? <LoadingList rows={1} height={200} /> : customers.error ? (
        <ErrorState compact error={customers.error} onRetry={() => void customers.refetch()} />
      ) : customers.data?.items.length ? (
        <Grid columns={{ base: 1, medium: 2, sidebar: 3 }} gap={14}>
          {customers.data.items.slice(0, 6).map((c) => <CustomerCard key={c.id} customer={c} plans={plans.data} footer="Manage subscription" />)}
        </Grid>
      ) : (
        <EmptyState title="No customer businesses yet" text="Businesses appear here once they start a trial." />
      )}

      {m?.recentActivity.length ? (
        <>
          <SectionTitle title="Recent activity" action={can(role, 'audit.view') ? <Button label="View all" variant="text" small onPress={() => go('/audit')} /> : undefined} />
          <Card padded={false}>
            {m.recentActivity.map((e, index) => (
              <View key={e.id} style={[styles.activity, index ? styles.activityBorder : null]}>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3" style={{ fontSize: 13 }}>{e.action}</AppText>
                  <AppText variant="tiny">{[e.detail, e.actor].filter(Boolean).join(' · ')}</AppText>
                </View>
                <AppText variant="tiny">{e.time}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E1E7F0', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  dateMain: { fontSize: 11, fontWeight: '800', color: '#586C89' },
  dateSub: { fontSize: 8, color: '#7B889B' },
  quickbar: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 25, ...shadow },
  quickbarWide: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  columns: { marginTop: 18, gap: 4 },
  columnsWide: { flexDirection: 'row', gap: 22, alignItems: 'flex-start' },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  activityBorder: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
});
