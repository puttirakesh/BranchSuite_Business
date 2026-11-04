import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadow } from '../../../theme/tokens';
import {
  AppText, Button, Card, ConfirmDialog, EmptyState, ErrorState, Grid, LoadingList, PageHeader, Pill, PressableCard, Screen, Skeleton, UsageCard, useToast,
} from '../../../shared/components';
import { useCustomer, useInvoices, usePlans, useSetAccountStatus, useTickets } from '../../../shared/hooks/queries';
import { usePermission } from '../../../core/permissions/usePermission';
import { USAGE_KEYS } from '../../../core/domain/subscription';
import { errorMessage } from '../../../core/api/api-error';
import { dash, money } from '../../../shared/utils/format';
import { customerStatus } from '../utils/customer-status';
import { SubscriptionEditor } from '../components/SubscriptionEditor';

/** APK `platform-customer/<id>`. */
export function CustomerDetailsScreen({ id }: { id: string }) {
  const customer = useCustomer(id);
  const plans = usePlans();
  const manage = usePermission('customers.manageLicence');
  const billing = usePermission('billing.view');
  const tickets = useTickets({ customerId: id });
  const invoices = useInvoices({ customerId: id });
  const accountStatus = useSetAccountStatus(id);
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (customer.isPending)
    return (
      <Screen>
        <Skeleton height={60} style={{ marginBottom: 20 }} />
        <Skeleton height={150} style={{ marginBottom: 20 }} />
        <LoadingList rows={2} />
      </Screen>
    );
  if (customer.error || !customer.data)
    return (
      <Screen>
        <PageHeader title="Customer" back="/customers" />
        <ErrorState error={customer.error} onRetry={() => void customer.refetch()} />
      </Screen>
    );

  const c = customer.data;
  const s = c.subscription;
  const plan = plans.data?.find((p) => p.id === s?.planId);
  const status = customerStatus(c);
  const subtitle = [c.industry, c.id].filter(Boolean).join(' · ');
  const deactivate = c.accountStatus === 'Active';

  return (
    <Screen onRefresh={() => Promise.all([customer.refetch(), tickets.refetch(), invoices.refetch()])}>
      <PageHeader
        title={c.name}
        subtitle={subtitle}
        back="/customers"
        action={manage ? <Button label="Manage licence" variant="soft" small onPress={() => setEditing(true)} /> : null}
      />
      <View style={styles.hero}>
        <View style={styles.between}>
          <AppText variant="eyebrow" color={colors.primary}>
            {[plan?.name ?? s?.planId ?? 'No plan', s?.cycle].filter(Boolean).join(' · ')}
          </AppText>
          <Pill label={status} />
        </View>
        <AppText variant="h2" style={{ marginTop: 18 }}>{dash(c.ownerName ?? 'Owner not reported')}</AppText>
        <AppText variant="small" color={colors.label} style={{ marginTop: 8 }}>
          {dash(c.ownerEmail)}
          {'\n'}Renews {dash(s?.renewOn)} · trial until {dash(s?.trialEndsOn)}
        </AppText>
      </View>

      {c.usage && plan ? (
        <Grid columns={{ base: 2, sidebar: 4 }} gap={14} style={{ marginBottom: 16 }}>
          {USAGE_KEYS.map((k) => <UsageCard key={k} name={k} used={c.usage![k]} limit={plan.limits[k]} />)}
        </Grid>
      ) : (
        <View style={{ marginBottom: 16 }}>
          <AppText variant="small">Capacity usage is not reported by the backend yet.</AppText>
        </View>
      )}

      <Card style={{ marginBottom: 14 }}>
        <AppText variant="h2">Customer workspace</AppText>
        <AppText variant="small" style={{ marginTop: 12 }}>
          {c.companies.length
            ? c.companies.map((co) => co.name + ' (' + (co.branches ? co.branches.join(', ') : co.branchCount + ' branches') + ')').join(' · ')
            : 'No companies recorded.'}
        </AppText>
        <AppText variant="small" style={{ marginTop: 12 }}>
          {c.usage ? 'Staff users: ' + c.usage.users + '. ' : ''}
          Platform admins manage subscriptions and support; employee salary, bank and CRM details remain in the business workspace.
        </AppText>
        {manage && c.accountStatus ? (
          <Button
            label={deactivate ? 'Deactivate business account' : 'Reactivate business account'}
            variant="secondary"
            full
            style={{ marginTop: 16 }}
            onPress={() => setConfirming(true)}
          />
        ) : null}
      </Card>

      <PageHeader level={2} title="Platform support" subtitle="Tickets from this customer." />
      {tickets.isPending ? <LoadingList rows={1} /> : tickets.error ? <ErrorState compact error={tickets.error} onRetry={() => void tickets.refetch()} /> :
        tickets.data?.items.length ? tickets.data.items.map((t) => (
          <PressableCard key={t.id} onPress={() => router.push(('/support/' + t.id) as never)} style={{ marginBottom: 10 }} accessibilityLabel={t.subject}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{t.subject}</AppText>
                <AppText variant="small">{[c.name, t.id].join(' · ')}</AppText>
              </View>
              <Pill label={t.status} />
            </View>
          </PressableCard>
        )) : <EmptyState title="No support tickets" text="Tickets this customer opens will appear here." />}

      {billing ? (
        <>
          <PageHeader level={2} title="Subscription billing" subtitle="This customer’s invoices." />
          {invoices.isPending ? <LoadingList rows={1} /> : invoices.error ? <ErrorState compact error={invoices.error} onRetry={() => void invoices.refetch()} /> :
            invoices.data?.items.length ? (
              <Grid columns={{ base: 1, sidebar: 2 }}>
                {invoices.data.items.map((i) => (
                  <PressableCard key={i.id} onPress={() => router.push(('/billing/' + i.id) as never)} accessibilityLabel={'Invoice ' + i.number}>
                    <View style={styles.between}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="h3">{i.customerName ?? c.name}</AppText>
                        <AppText variant="small">{i.number}</AppText>
                      </View>
                      <Pill label={i.status} />
                    </View>
                    <View style={styles.listMeta}>
                      <Text style={styles.metaText}>{[i.cycle, i.dueOn ? 'due ' + i.dueOn : null].filter(Boolean).join(' · ')}</Text>
                      <Text style={styles.metaStrong}>{money(i.amount, i.currency)}</Text>
                    </View>
                  </PressableCard>
                ))}
              </Grid>
            ) : <EmptyState title="No invoices yet" text="Subscription invoices for this customer will appear here." />}
        </>
      ) : null}

      {manage ? <SubscriptionEditor customer={c} visible={editing} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        visible={confirming}
        title={deactivate ? 'Deactivate this business?' : 'Reactivate this business?'}
        text={deactivate ? 'Staff in ' + c.name + ' will lose access until the account is reactivated. Their records are kept.' : 'Staff in ' + c.name + ' will be able to sign in again.'}
        confirmLabel={deactivate ? 'Deactivate' : 'Reactivate'}
        busy={accountStatus.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await accountStatus.mutateAsync(deactivate ? 'INACTIVE' : 'ACTIVE');
            toast(deactivate ? 'Business deactivated.' : 'Business reactivated.');
          } catch (error) {
            toast(errorMessage(error));
          }
          setConfirming(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  hero: { backgroundColor: '#EEEFFC', borderWidth: 1, borderColor: '#DFE6F5', borderRadius: radius.hero, padding: 23, marginBottom: 22, ...shadow },
  listMeta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F7', marginTop: 16, paddingTop: 14, gap: 10 },
  metaText: { fontSize: 11, color: colors.muted, flex: 1 },
  metaStrong: { fontSize: 11, fontWeight: '700', color: colors.ink },
});
