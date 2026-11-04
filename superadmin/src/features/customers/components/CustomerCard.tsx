import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadow } from '../../../theme/tokens';
import { Avatar, Icon, Pill } from '../../../shared/components';
import type { Plan } from '../../plans/types';
import { customerStatus } from '../utils/customer-status';
import type { Customer } from '../types';

/** APK `.studio-health-card`: used on the dashboard and the customer list. */
export function CustomerCard({ customer, plans, footer = 'View business' }: { customer: Customer; plans: Plan[] | undefined; footer?: string }) {
  const status = customerStatus(customer);
  const planName = plans?.find((p) => p.id === customer.subscription?.planId)?.name ?? customer.subscription?.planId ?? null;
  const meta = [planName ? planName + ' plan' : null, customer.industry].filter(Boolean).join(' · ') || 'Plan details not reported';
  const u = customer.usage;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={customer.name + ', ' + status}
      onPress={() => router.push(('/customers/' + encodeURIComponent(customer.id)) as never)}
      style={({ pressed }) => [styles.card, pressed ? { borderColor: '#CFC4EA' } : null]}
    >
      <View style={styles.between}>
        <Avatar name={customer.name} />
        <Pill label={status} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
      <View style={styles.numbers}>
        {u ? (
          <>
            <View style={styles.num}><Icon name="team" size={14} color={colors.subtle} /><Text style={styles.numText}>{u.employees} employees</Text></View>
            <View style={styles.num}><Icon name="building" size={14} color={colors.subtle} /><Text style={styles.numText}>{u.branches} branches</Text></View>
          </>
        ) : (
          <View style={styles.num}><Icon name="building" size={14} color={colors.subtle} /><Text style={styles.numText}>{customer.companies.length} companies</Text></View>
        )}
      </View>
      <View style={styles.foot}>
        <Text style={styles.footText}>{footer}</Text>
        <Icon name="chevron" size={14} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, paddingTop: 20, paddingHorizontal: 20, overflow: 'hidden', ...shadow },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '700', color: '#263B56', marginTop: 16, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.subtle },
  numbers: { flexDirection: 'row', gap: 16, marginTop: 16, marginBottom: 16, flexWrap: 'wrap' },
  num: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numText: { fontSize: 11, color: colors.muted },
  foot: { marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#EEF2F7', backgroundColor: colors.surfaceRaised, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  footText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
