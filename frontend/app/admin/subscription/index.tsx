import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { subscriptionsApi, type BusinessSubscriptionDto } from '../../../src/core/admin/api';
import { useAdminScope } from '../../../src/core/admin/scope';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

const label = (value: string) => value.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default function SubscriptionPage() {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const scope = useAdminScope();
  const [subscription, setSubscription] = useState<BusinessSubscriptionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setSubscription(null);
    subscriptionsApi.current().then(record => { if (active) setSubscription(record); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load subscription.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, scope?.tenantId]));
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Your subscription</Text>
      <Text style={styles.subtitle}>The plan selected for your business account.</Text>
      {loading ? <ActivityIndicator accessibilityLabel="Loading subscription" /> : error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.secondary}><Text style={styles.link}>Retry</Text></Pressable></View> : subscription ? <View style={styles.card}>
        <View style={styles.badge}><Text style={styles.status}>{label(subscription.status)}</Text></View>
        <Text style={styles.cardTitle}>{label(subscription.planId)} plan</Text>
        <Text style={styles.detailValue}>Billing cycle: {label(subscription.billingCycle)}</Text>
        <Text style={styles.subtitle}>Selected on {new Date(subscription.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        {subscription.status === 'PENDING_ACTIVATION' && <Text style={styles.note}>Your plan is awaiting activation. Contact your account administrator for the next step.</Text>}
      </View> : <View style={styles.card}><Text style={styles.cardTitle}>No subscription record</Text><Text style={styles.subtitle}>Ask your account administrator to review your business subscription.</Text></View>}
      <View style={styles.card}><Text style={styles.cardTitle}>Plan changes and payments</Text><Text style={styles.subtitle}>Online plan changes, renewals, and payment collection are not available yet. Contact your account administrator for assistance.</Text></View>
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
  secondary: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 14, fontWeight: '600', color: '#345cf2' },
});
