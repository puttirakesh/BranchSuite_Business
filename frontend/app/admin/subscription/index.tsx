import { useToastState } from '../../../src/ui/useToastState';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { subscriptionsApi, type BusinessSubscriptionDto } from '../../../src/core/admin/api';
import { useAdminScope } from '../../../src/core/admin/scope';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { useOrderCheckout } from '../../../src/features/subscriptions/useOrderCheckout';
import { PaymentHistory } from '../../../src/features/subscriptions/PaymentHistory';
import { daysLeftLabel, formatDate, formatRupees } from '../../../src/features/subscriptions/format';

const USAGE_ROWS = [['employees', 'Active employees'], ['users', 'Staff users'], ['branches', 'Branches'], ['companies', 'Companies']] as const;

const label = (value: string) => value.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default function SubscriptionPage() {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const scope = useAdminScope();
  const { session } = useAuth();
  // Only the business owner can see payments or renew; staff just see the plan.
  const canManageBilling = session?.subscription?.canManageBilling === true;
  const checkout = useOrderCheckout(canManageBilling);
  const billing = checkout.status;
  const [subscription, setSubscription] = useState<BusinessSubscriptionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setSubscription(null);
    subscriptionsApi.current().then(record => { if (active) setSubscription(record); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load subscription.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, scope?.tenantId]));
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <AdminPageHeading title="Your subscription" onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} />
      
      {loading ? <ActivityIndicator accessibilityLabel="Loading subscription" /> : error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable></View> : subscription ? <View style={styles.card}>
        <View style={styles.badge}><Text style={styles.status}>{label(subscription.status)}</Text></View>
        <Text style={styles.cardTitle}>{label(subscription.planId)} plan</Text>
        <Text style={styles.detailValue}>Billing cycle: {label(subscription.billingCycle)}</Text>
        <Text style={styles.subtitle}>Selected on {new Date(subscription.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        {subscription.currentPeriodEnd ? <Text style={styles.subtitle}>{'Access until '}{new Date(subscription.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text> : null}
        {subscription.status === 'PENDING_ACTIVATION' && <Text style={styles.note}>Your plan is awaiting activation. The business owner can complete payment from the billing screen.</Text>}
      </View> : <View style={styles.card}><Text style={styles.cardTitle}>No subscription record</Text><Text style={styles.subtitle}>Ask your account administrator to review your business subscription.</Text></View>}
      {canManageBilling && billing ? <View style={styles.card} accessibilityLabel="Plan validity">
        <Text style={styles.cardTitle}>Plan validity</Text>
        <View style={styles.usageRow}><Text style={styles.detailValue}>Days remaining</Text><Text style={[styles.detailValue, billing.daysRemaining <= 7 && styles.full]}>{billing.accessAllowed ? daysLeftLabel(billing.daysRemaining) : 'Expired'}</Text></View>
        <View style={styles.usageRow}><Text style={styles.detailValue}>Started</Text><Text style={styles.detailValue}>{formatDate(billing.currentPeriodStart ?? billing.activatedAt)}</Text></View>
        <View style={styles.usageRow}><Text style={styles.detailValue}>Expires</Text><Text style={styles.detailValue}>{formatDate(billing.expiresAt)}</Text></View>
        <View style={styles.usageRow}><Text style={styles.detailValue}>Last payment</Text><Text style={styles.detailValue}>{formatDate(billing.lastPaymentAt)}</Text></View>
        <View style={styles.usageRow}><Text style={styles.detailValue}>Renewal price</Text><Text style={styles.detailValue}>{formatRupees(billing.amountPaise)} / {billing.billingCycle === 'annual' ? 'year' : 'month'}</Text></View>
        {checkout.error ? <Text accessibilityRole="alert" style={styles.error}>{checkout.error}</Text> : null}
        {checkout.notice ? <Text style={styles.note}>{checkout.notice}</Text> : null}
        {billing.payBlockedReason ? <Text style={styles.subtitle}>{billing.payBlockedReason}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !billing.canPay || checkout.working, busy: checkout.working }} disabled={!billing.canPay || checkout.working} onPress={() => void checkout.pay()} style={[styles.primary, (!billing.canPay || checkout.working) && styles.primaryDisabled]}><Text style={styles.primaryText}>{checkout.working ? 'Processing…' : 'Renew Plan'}</Text></Pressable>
        <Text style={styles.subtitle}>One-time payment. Renewing early adds time after your current expiry. Nothing renews automatically.</Text>
      </View> : null}
      {canManageBilling && billing ? <View style={styles.card} accessibilityLabel="Payment history"><Text style={styles.cardTitle}>Payment history</Text><PaymentHistory payments={billing.paymentHistory} /></View> : null}
      {!loading && !error && subscription?.limits && subscription.usage ? <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan usage</Text>
        {USAGE_ROWS.map(([key, name]) => {
          const used = subscription.usage![key], limit = subscription.limits![key];
          return <View key={key} style={styles.usageRow}>
            <Text style={styles.detailValue}>{name}</Text>
            <Text style={[styles.detailValue, used >= limit && styles.full]}>{used} of {limit}{used >= limit ? ' · limit reached' : ''}</Text>
          </View>;
        })}
        <Text style={styles.subtitle}>Adding more than your plan allows is blocked. Staff users are active people with a business role such as manager, HR, payroll or sales.</Text>
      </View> : null}
      <View style={styles.card}><Text style={styles.cardTitle}>Plan changes and payments</Text><Text style={styles.subtitle}>Your plan is prepaid and does not renew automatically: renew from this screen before it expires. Changing plan or billing cycle is not available in the app yet — contact BranchSuite support.</Text></View>
    </ScrollView>
    <AdminBottomNavigation />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { padding: 20, gap: 16, paddingBottom: 36 },
  title: { fontSize: 26, fontWeight: '700', color: '#20334f' }, subtitle: { fontSize: 14, lineHeight: 22, color: '#607591' },
  card: { padding: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: 12 },
  cardTitle: { fontSize: 19, fontWeight: '700', color: '#20334f' }, detailValue: { fontSize: 15, color: '#20334f' },
  badge: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#e8f4ef', borderRadius: 8 },
  status: { color: '#177f74', fontWeight: '600' }, note: { fontSize: 14, lineHeight: 22, color: '#80581d' }, error: { color: '#b3261e', fontSize: 14 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }, full: { color: '#b3261e', fontWeight: '600' },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#3157D5', paddingHorizontal: 16 }, primaryDisabled: { opacity: 0.5 }, primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 14, fontWeight: '600', color: '#345cf2' },
});
