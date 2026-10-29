import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { SearchField } from '../../../src/ui/SearchField';
import { calendarDateKey } from '../../../src/shared/validation/date';
import { SelectField } from '../../../src/ui/SelectField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { useAdminScope } from '../../../src/core/admin/scope';
import { billingApi, type BillingInvoiceDto } from '../../../src/core/admin/workspace-records.api';
import { DatePickerField } from '../../../src/ui/DatePickerField';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

const today = () => calendarDateKey(new Date());
export default function BillingPage() {
  const { styles } = useAdminLayout(baseStyles, 'page');
  const scope = useAdminScope();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [invoices, setInvoices] = useState<BillingInvoiceDto[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!scope?.companyId) return () => { active = false; };
    setLoading(true); setError('');
    billingApi.invoices(scope.companyId).then(records => { if (active) setInvoices(records); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load invoices.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, scope?.companyId]));

  const issueInvoice = async () => {
    if (!scope?.companyId || saving) return;
    if (description.trim().length < 3 || !/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError('Enter an invoice description and a positive amount with up to two decimal places.'); return; }
    setSaving(true); setError('');
    try {
      const saved = await billingApi.createInvoice({ companyId: scope.companyId, description: description.trim(), amount: amount.trim(), dueDate: dueDate || undefined });
      setInvoices(current => [saved, ...current]); setDescription(''); setAmount(''); setDueDate(''); toast.success('Invoice issued successfully.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not issue invoice.'); }
    finally { setSaving(false); }
  };
  const recordPayment = async (invoice: BillingInvoiceDto) => {
    const note = paymentNotes[invoice.id]?.trim();
    if (!note || saving) { if (!note) setError('Enter a payment reference or note to record a manual payment.'); return; }
    setSaving(true); setError('');
    try { const saved = await billingApi.recordPayment(invoice.id, note); setInvoices(current => current.map(item => item.id === saved.id ? saved : item)); setPaymentNotes(current => ({ ...current, [invoice.id]: '' })); toast.success('Payment record saved.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record payment.'); }
    finally { setSaving(false); }
  };

  const visibleInvoices = invoices.filter(invoice => (statusFilter === 'ALL' || invoice.status === statusFilter) && (invoice.invoiceNumber + ' ' + invoice.description + ' ' + (invoice.paymentNote ?? '')).toLowerCase().includes(query.trim().toLowerCase()));
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AdminPageHeading title="Billing & invoices" onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} refreshDisabled={saving} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <View style={styles.card}><Text style={styles.cardTitle}>Issue invoice</Text>
        <TextInput validation={{ required: true, minLength: 3 }} accessibilityLabel="Invoice description" value={description} onChangeText={setDescription} editable={!saving} maxLength={300} style={styles.input} />
        <TextInput validation={{ required: true, min: 0.01 }} accessibilityLabel="Invoice amount" value={amount} onChangeText={setAmount} editable={!saving} keyboardType="decimal-pad" style={styles.input} />
        <DatePickerField label="Due date (optional)" value={dueDate} onChange={setDueDate} minDate={today()} disabled={saving} clearable />
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void issueInvoice()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Issue invoice'}</Text></Pressable>
      </View>
      <Text style={styles.sectionTitle}>Invoice history</Text>
      <SearchField accessibilityLabel="Search invoices" value={query} onChangeText={setQuery} />
      <SelectField label="Invoice status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ALL', label: 'All statuses' }, { value: 'ISSUED', label: 'Issued' }, { value: 'PAID', label: 'Paid' }, { value: 'VOID', label: 'Void' }]} />
      {!loading && invoices.length > 0 && !visibleInvoices.length && <Text style={styles.subtitle}>No invoices match your search or status filter.</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading invoices" /> : invoices.length === 0 ? <View style={styles.card}><Text style={styles.subtitle}>No invoices have been issued for this company.</Text></View> : visibleInvoices.map(invoice => <View key={invoice.id} style={styles.card}>
        <View style={styles.row}><View style={styles.flex}><Text style={styles.cardTitle}>{invoice.invoiceNumber}</Text><Text style={styles.subtitle}>{invoice.description}</Text></View><Text style={[styles.status, invoice.status === 'PAID' && styles.paid]}>{invoice.status}</Text></View>
        <Text style={styles.amount}>{invoice.currency} {Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.subtitle}>Issued {new Date(invoice.issuedAt).toLocaleDateString('en-IN')}{invoice.dueAt ? ` · Due ${new Date(invoice.dueAt).toLocaleDateString('en-IN')}` : ''}{invoice.paidAt ? ` · Paid ${new Date(invoice.paidAt).toLocaleDateString('en-IN')}` : ''}</Text>
        {invoice.status === 'ISSUED' && <><TextInput validation={{ required: true, minLength: 2 }} accessibilityLabel={`Payment note for ${invoice.invoiceNumber}`} value={paymentNotes[invoice.id] ?? ''} onChangeText={value => setPaymentNotes(current => ({ ...current, [invoice.id]: value }))} editable={!saving} maxLength={300} style={styles.input} /><Pressable accessibilityRole="button" disabled={saving} onPress={() => void recordPayment(invoice)} style={styles.secondary}><Text style={styles.link}>Record confirmed payment</Text></Pressable></>}
        {invoice.paymentNote && <Text style={styles.subtitle}>Payment note: {invoice.paymentNote}</Text>}
      </View>)}
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 14 },
  card: { padding: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16, gap: formSpacing.field }, cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#20334f' }, sectionTitle: { fontSize: 18, fontWeight: '700', color: '#20334f', marginTop: 8 }, subtitle: { fontSize: 12, lineHeight: 19, color: '#607591' }, amount: { fontSize: 20, fontWeight: '700', color: '#20334f' }, status: { fontSize: 11, color: '#80581d', fontWeight: '700' }, paid: { color: '#177f74' }, flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  notice: { padding: 14, backgroundColor: '#fff4e2', borderRadius: 12 }, noticeText: { fontSize: 12, lineHeight: 19, color: '#80581d' }, input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ccd6e5', borderRadius: 10, color: '#20334f' }, primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#345cf2', borderRadius: 10 }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#eaf0ff' }, link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e', fontSize: 13 },
});
