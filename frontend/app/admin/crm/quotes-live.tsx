import { formSpacing } from '../../../src/shared/theme/formSpacing';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { SelectField } from '../../../src/ui/SelectField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { getAdminScope, useAdminScope } from '../../../src/core/admin/scope';
import { getAvailableBranches } from '../../../src/core/admin/available-branches';
import { dealsApi, type DealDto } from '../../../src/core/admin/deals.api';
import { quotesApi, type Quote, type QuoteLine, type QuoteStatus } from '../../../src/core/admin/quotes.api';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

const transitions: Partial<Record<QuoteStatus, QuoteStatus[]>> = { DRAFT: ['SENT', 'CANCELLED'], SENT: ['ACCEPTED', 'REJECTED', 'CANCELLED'] };
const pricePattern = /^(0|[1-9]\d{0,13})(\.\d{1,2})?$/;
type QuoteLineDraft = Omit<QuoteLine, 'quantity'> & { quantity: string };
const emptyLines = (): QuoteLineDraft[] => [{ description: '', quantity: '1', unitPrice: '0' }];

export default function QuotesLive() {
  const { styles } = useAdminLayout(baseStyles);
  const router = useRouter();
  const scopeSelection = useAdminScope();
  const params = useLocalSearchParams<{ id?: string; dealId?: string; branch?: string }>();
  const [deals, setDeals] = useState<DealDto[]>([]);
  const [dealId, setDealId] = useState('');
  const selectedDeal = useRef('');
  const appliedRoute = useRef('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState(emptyLines);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useToastState('', 'error');
  const [reload, setReload] = useState(0);
  const busyRef = useRef(false);
  const reset = () => { setEditing(null); setTitle(''); setNotes(''); setLines(emptyLines()); };

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    setDeals([]); setQuotes([]); setDealId('');
    (async () => {
      const [scope, branches] = await Promise.all([getAdminScope(), getAvailableBranches()]);
      const branchId = scope.branchId ?? undefined;
      const accessibleDeals = await dealsApi.list(scope.companyId, branchId);
      const routeKey = `${scope.companyId}:${params.id ?? ''}:${params.dealId ?? ''}`;
      let requested = selectedDeal.current;
      if (appliedRoute.current !== routeKey) requested = params.id ? (await quotesApi.get(params.id)).dealId : params.dealId ?? '';
      if (requested && !accessibleDeals.some(deal => deal.id === requested) && (params.id || params.dealId) && appliedRoute.current !== routeKey) throw new Error('This quote or deal is outside the selected branch.');
      const next = accessibleDeals.some(deal => deal.id === requested) ? requested : accessibleDeals[0]?.id ?? '';
      const records = await quotesApi.listCompany(scope.companyId, branchId);
      if (!active) return;
      if (next !== selectedDeal.current) reset();
      selectedDeal.current = next; appliedRoute.current = routeKey;
      setDeals(accessibleDeals); setDealId(next); setQuotes(records);
    })().catch(cause => { if (active) { setQuotes([]); setError(cause instanceof Error ? cause.message : 'Unable to load quotes.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, scopeSelection?.companyId, scopeSelection?.branchId, params.branch, params.id, params.dealId]));

  const choose = (id: string) => {
    if (busyRef.current || loading || id === dealId) return;
    selectedDeal.current = id; setDealId(id); setQuotes([]); reset(); setReload(value => value + 1);
  };
  const edit = (quote: Quote) => {
    setEditing(quote); setTitle(quote.title); setNotes(quote.notes ?? '');
    setLines(quote.items.map(item => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })));
  };
  const save = async () => {
    if (busyRef.current || loading) return;
    if (!dealId || !title.trim() || title.trim().length > 180 || notes.length > 2500 || !lines.length || lines.some(line => !line.description.trim() || line.description.trim().length > 300 || !/^\d+$/.test(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > 1000000 || !pricePattern.test(line.unitPrice.trim()))) {
      setError('Enter a title and valid items. Quantity must be 1–1,000,000; prices must have up to two decimal places.'); return;
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const body = { title: title.trim(), notes, items: lines.map(line => ({ ...line, quantity: Number(line.quantity), description: line.description.trim(), unitPrice: line.unitPrice.trim() })) };
      if (editing) await quotesApi.update(editing.id, { ...body, expectedVersion: editing.version });
      else await quotesApi.create({ ...body, dealId });
      toast.success(editing ? 'Quote updated successfully.' : 'Quote created successfully.');
      reset(); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save quote.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const move = async (quote: Quote, status: QuoteStatus) => {
    if (busyRef.current || loading) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await quotesApi.status(quote.id, status, quote.version); toast.success('Quote status updated.'); if (editing?.id === quote.id) reset(); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to change quote status.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const updateLine = (index: number, field: keyof QuoteLine, value: string) => setLines(old => old.map((line, position) => position === index ? { ...line, [field]: value } : line));
  const lostDeal = deals.find(deal => deal.id === dealId)?.stage === 'LOST';

  return <ScrollView style={styles.page} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <AdminPageHeading title="Quotes" onBack={() => router.replace('/admin/crm')}><Pressable disabled={busy} onPress={() => { reset(); setReload(value => value + 1); }} style={styles.chip}><Text>Refresh</Text></Pressable></AdminPageHeading>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {loading ? <ActivityIndicator accessibilityLabel="Loading quotes" /> : <>
      <SelectField label="Quotation deal" value={dealId} options={deals.map(deal => ({ value: deal.id, label: deal.title }))} onChange={choose} disabled={busy} />
      {dealId ? <>
        {(!lostDeal || editing) && <>
          <Text style={styles.section}>{editing ? 'Edit draft quote' : 'New quotation'}</Text>
          <TextInput validation={{ required: true }} accessibilityLabel="Quote title" editable={!busy} style={styles.input} value={title} maxLength={180} onChangeText={setTitle} />
          <TextInput accessibilityLabel="Quote notes" editable={!busy} style={styles.input} value={notes} maxLength={2500} onChangeText={setNotes} />
          {lines.map((line, index) => <View key={index} style={styles.line}>
            <TextInput validation={{ required: true }} accessibilityLabel={`Item ${index + 1} description`} editable={!busy} style={styles.input} maxLength={300} value={line.description} onChangeText={value => updateLine(index, 'description', value)} />
            <View style={styles.wrap}>
              <TextInput validation={{ required: true, min: 1, max: 1000000 }} accessibilityLabel={`Item ${index + 1} quantity`} editable={!busy} style={[styles.input, styles.number]} keyboardType="number-pad" value={String(line.quantity)} onChangeText={value => updateLine(index, 'quantity', value)} />
              <TextInput validation={{ required: true, min: 0, wholeDigits: 14 }} accessibilityLabel={`Item ${index + 1} unit price`} editable={!busy} style={[styles.input, styles.number]} keyboardType="decimal-pad" value={line.unitPrice} onChangeText={value => updateLine(index, 'unitPrice', value)} />
              <Pressable disabled={busy} onPress={() => setLines(old => old.filter((_, position) => position !== index))}><Text style={styles.link}>Remove item</Text></Pressable>
            </View>
          </View>)}
          <View style={styles.wrap}>
            <Pressable disabled={busy} onPress={() => setLines(old => [...old, ...emptyLines()])} style={styles.button}><Text style={styles.buttonText}>Add item</Text></Pressable>
            <Pressable disabled={busy} onPress={() => void save()} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}</Text></Pressable>
            {editing && <Pressable disabled={busy} onPress={reset}><Text style={styles.link}>Cancel edit</Text></Pressable>}
          </View>
        </>}
        {lostDeal && !editing && <Text style={styles.note}>New quotes cannot be created for a lost deal.</Text>}
        <Text style={styles.section}>Saved quotes</Text>
        {!quotes.length && <Text>No quotes in the selected branches yet.</Text>}
        {quotes.map(quote => <View key={quote.id} style={[styles.card, quote.id === params.id && styles.selected]}>
          <Text style={styles.quoteTitle}>{quote.title} · {quote.status}</Text>
          <Text>{quote.currency} {String(quote.total)} · {quote.items.length} item(s) · revision {quote.version}</Text>
          {!!quote.notes && <Text>{quote.notes}</Text>}
          {quote.items.map(item => <Text key={item.id}>{item.description} · {item.quantity} × {item.unitPrice} = {String(item.lineTotal)}</Text>)}
          <View style={styles.wrap}>
            {quote.status === 'DRAFT' && <Pressable disabled={busy} onPress={() => { selectedDeal.current = quote.dealId; setDealId(quote.dealId); edit(quote); }} style={styles.chip}><Text>Edit draft</Text></Pressable>}
            {(transitions[quote.status] ?? []).map(status => <Pressable disabled={busy} key={status} onPress={() => void move(quote, status)} style={styles.chip}><Text>{status}</Text></Pressable>)}
          </View>
        </View>)}
      </> : <Text>No accessible deals found. Create a deal first.</Text>}
    </>}
  </ScrollView>;
}

const baseStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f6f8fc' }, body: { padding: 20, gap: formSpacing.field, paddingBottom: 60 },
  heading: { fontSize: 24, fontWeight: '700', color: '#182944' }, note: { color: '#52617c' },
  link: { color: '#345cf2', fontWeight: '600' }, error: { color: '#b3261e' }, label: { fontWeight: '700' },
  section: { fontSize: 19, fontWeight: '700', marginTop: 12, color: '#182944' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: formSpacing.field, alignItems: 'center' },
  chip: { borderWidth: 1, borderColor: '#ccd6ed', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  selected: { backgroundColor: '#dbe6ff' },
  input: { borderWidth: 1, borderColor: '#cfd7e6', backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, minWidth: 0, flexGrow: 1 },
  number: { flexGrow: 0, width: 120 }, button: { backgroundColor: '#345cf2', padding: 12, borderRadius: 8 },
  buttonText: { color: 'white', fontWeight: '700' }, line: { gap: formSpacing.field, borderWidth: 1, borderColor: '#e1e5ee', padding: 10, borderRadius: 10 },
  card: { borderWidth: 1, borderColor: '#d7deec', backgroundColor: 'white', padding: 14, borderRadius: 12, gap: 8 },
  quoteTitle: { fontWeight: '700', color: '#182944', fontSize: 16 },
});
