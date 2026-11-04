import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, shadow } from '../../../theme/tokens';
import { AppText, Button, ErrorState, MoneyRow, Note, PageHeader, Pill, Screen, Skeleton, useToast } from '../../../shared/components';
import { pendingEndpoints } from '../../../core/api/endpoints';
import { useInvoice } from '../../../shared/hooks/queries';
import { isPreview } from '../../../core/data/source';
import { dash, money } from '../../../shared/utils/format';

/** APK `platform-invoice/<id>`. Payment simulation from the APK is intentionally not reproduced. */
export function InvoiceDetailsScreen({ id }: { id: string }) {
  const invoice = useInvoice(id);
  const toast = useToast();
  if (invoice.isPending) return <Screen><Skeleton height={60} style={{ marginBottom: 20 }} /><Skeleton height={380} /></Screen>;
  if (invoice.error || !invoice.data)
    return <Screen><PageHeader title="Subscription invoice" back="/billing" /><ErrorState error={invoice.error} onRetry={() => void invoice.refetch()} /></Screen>;
  const i = invoice.data;
  const paid = i.status === 'Paid';
  return (
    <Screen onRefresh={invoice.refetch}>
      <PageHeader
        title="Subscription invoice"
        subtitle={i.number}
        back="/billing"
        action={
          <Button
            label="Save PDF"
            variant="secondary"
            small
            icon="download"
            onPress={() => toast('PDF export needs ' + pendingEndpoints.invoicePdf + ', which the backend does not provide yet.')}
          />
        }
      />
      <View style={styles.doc}>
        <View style={styles.between}>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">BranchSuite</AppText>
            <AppText variant="small">{isPreview() ? 'PREVIEW DOCUMENT · NOT A TAX INVOICE' : 'SUBSCRIPTION INVOICE'}</AppText>
          </View>
          <Pill label={i.status} />
        </View>
        <View style={styles.divider} />
        <AppText variant="body">Customer: <AppText variant="body" style={{ fontWeight: '700' }}>{i.customerName ?? i.customerId}</AppText></AppText>
        {i.customerEmail ? <AppText variant="body">{i.customerEmail}</AppText> : null}
        <MoneyRow label={[i.planName ?? i.description ?? 'Subscription', i.cycle].filter(Boolean).join(' · ')} value={money(i.subtotal ?? i.amount, i.currency)} />
        {i.discount != null ? <MoneyRow label="Offer discount" value={'- ' + money(i.discount, i.currency)} /> : null}
        <MoneyRow total label="Amount payable" value={money(i.amount, i.currency)} />
        <AppText variant="small" style={{ marginTop: 16 }}>
          Issued {dash(i.issuedOn)} · due {dash(i.dueOn)}{'\n'}Reference: {i.reference ?? (paid ? '—' : 'Not paid')}
        </AppText>
      </View>
      {paid ? (
        <Note tone="success">{isPreview() ? 'Preview payment record' : 'Payment recorded'}{i.paidOn ? ' on ' + i.paidOn : ''}. Subscription status is managed separately.</Note>
      ) : (
        <Note tone="warning">This invoice is unpaid. Collections run through the payment gateway integration, which is not connected to this console yet.</Note>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  doc: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 26, marginBottom: 19, ...shadow },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  divider: { height: 1, backgroundColor: '#E8EDF4', marginVertical: 18 },
});
