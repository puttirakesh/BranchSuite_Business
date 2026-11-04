import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../../theme/tokens';
import { AppText, Pill, PressableCard } from '../../../shared/components';
import { money } from '../../../shared/utils/format';
import type { Invoice } from '../types';

/** APK `invoiceRows` list card. */
export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <PressableCard onPress={() => router.push(('/billing/' + encodeURIComponent(invoice.id)) as never)} accessibilityLabel={'Invoice ' + invoice.number + ', ' + invoice.status}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3" numberOfLines={1}>{invoice.customerName ?? 'Customer ' + invoice.customerId.slice(0, 8)}</AppText>
          <AppText variant="small">{invoice.number}</AppText>
        </View>
        <Pill label={invoice.status} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{[invoice.cycle, invoice.dueOn ? 'due ' + invoice.dueOn : invoice.issuedOn ? 'issued ' + invoice.issuedOn : null].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.amount}>{money(invoice.amount, invoice.currency)}</Text>
      </View>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF2F7', marginTop: 16, paddingTop: 14, gap: 10 },
  metaText: { fontSize: 11, color: colors.muted, flex: 1 },
  amount: { fontSize: 11, fontWeight: '700', color: colors.ink },
});
