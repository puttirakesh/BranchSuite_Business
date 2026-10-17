import { AppIcon } from "./AppIcon";
import { CompanyName, currentCompanyName } from '../core/admin/scope';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '../core/admin/storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leadsKey, newLeadId, readLeads, type Lead, type Quote } from '../core/leads';
import { getAvailableBranches, useAvailableBranches } from '../core/admin/available-branches';
import { BranchOptionsStatus } from './BranchOptionsStatus';
import { AdminBottomNavigation } from './AdminBottomNavigation';

import { useAdminLayout } from './useAdminLayout';

type StageAction = { label: string; stage: string };
const stageActions = (stage: string): StageAction[] => {
  if (stage === 'Won') return [{ label: 'Reopen opportunity', stage: 'Qualified' }];
  if (stage === 'Lost') return [{ label: 'Reopen opportunity', stage: 'New' }];
  const progress: Record<string, StageAction[]> = {
    New: [{ label: 'Mark contacted', stage: 'Contacted' }, { label: 'Qualify', stage: 'Qualified' }],
    Contacted: [{ label: 'Qualify', stage: 'Qualified' }],
    Qualified: [{ label: 'Mark proposal sent', stage: 'Proposal' }],
    Proposal: [{ label: 'Start negotiation', stage: 'Negotiation' }],
    Negotiation: [],
  };
  return [...(progress[stage] || []), ...(['Qualified', 'Proposal', 'Negotiation'].includes(stage) ? [{ label: 'Mark won', stage: 'Won' }] : []), { label: 'Mark lost', stage: 'Lost' }];
};
const money = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dealStage = (lead: Lead) => {
  const stage = lead.opportunity?.stage || lead.stage;
  return stage === 'Active' ? 'Won' : stage === 'Inactive' ? 'Lost' : stage;
};
function displayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
}

export function OpportunityDetails() {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    readLeads().then(leads => {
      const found = leads.find(item => item.opportunity?.id === id);
      if (!found) throw new Error('Opportunity could not be found.');
      if (active) setLead(found);
    }).catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load this opportunity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]));

  const save = async (action: StageAction) => {
    if (!lead || savingRef.current) return;
    setError(''); setNotice('');
    savingRef.current = true; setSaving(true);
    try {
      const leads = await readLeads();
      const current = leads.find(item => item.opportunity?.id === id);
      if (!current?.opportunity) throw new Error('Opportunity could not be found.');
      const previousStage = dealStage(current);
      if (!stageActions(previousStage).some(option => option.label === action.label && option.stage === action.stage)) { setLead(current); throw new Error('This opportunity has changed. Choose an action for its current stage.'); }
      const opportunity = { ...current.opportunity };
      opportunity.stage = action.stage;
      const updated: Lead = { ...current, stage: action.stage === 'Won' ? 'Active' : action.stage === 'Lost' ? 'Inactive' : action.stage, opportunity, history: [...(current.history || []), { id: newLeadId(), kind: 'stage', actor: 'Admin', createdAt: new Date().toISOString(), note: `${action.label}: ${previousStage} → ${action.stage}.` }] };
      await AsyncStorage.setItem(leadsKey, JSON.stringify(leads.map(item => item.id === current.id ? updated : item)));
      setLead(updated);
      setNotice(`Moved to ${action.stage}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const detail = (label: string, value: string, full = false) => <View style={[styles.detail, full && styles.fullDetail]}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View>;
  const opportunity = lead?.opportunity;
  const currentStage = lead ? dealStage(lead) : 'New';

  return <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}><View style={styles.page}>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back to sales pipeline" disabled={saving} onPress={() => router.push('/admin/crm/deals')} style={styles.back}><AppIcon symbol="‹" style={styles.backGlyph} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>Opportunity</Text>{opportunity && <Text selectable style={styles.subtitle}>{opportunity.id}</Text>}</View>{lead && !loading && !loadError && <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push({ pathname: '/admin/crm/lead-form', params: { edit: lead.id } })} style={styles.edit}><Text style={styles.buttonText}>Edit</Text></Pressable>}</View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading opportunity" color="#345cf2" /> : loadError ? <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.edit}><Text style={styles.buttonText}>Retry</Text></Pressable></View> : lead && opportunity && <>
        <View style={[styles.card, styles.summaryCard]}><Text style={styles.summaryLabel}>{currentStage.toUpperCase()} OPPORTUNITY</Text><Text style={styles.opportunityName}>{opportunity.name}</Text><Text style={styles.amount}>{money(opportunity.estimatedValue)}</Text><Text style={styles.subtitle}>Expected close {displayDate(lead.followUpDate)} · {lead.owner}</Text></View>
        <View style={styles.card}><View style={styles.details}>{detail('STAGE', currentStage)}{detail('OWNER', lead.owner)}{detail('BRANCH', lead.branch)}{detail('NOTES', lead.notes, true)}</View>
          <View style={styles.divider} /><Text style={styles.label}>Next action</Text>
          <View style={styles.stageActions}>{stageActions(currentStage).map((action, index) => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void save(action)} style={[styles.stageAction, index === 0 && styles.stageActionPrimary, action.stage === 'Lost' && styles.stageActionLost, saving && styles.pressed]}><Text style={[styles.buttonText, index === 0 && styles.primaryText, action.stage === 'Lost' && styles.lostActionText]}>{action.label}</Text></Pressable>)}</View>
          <Text style={styles.subtitle}>{saving ? 'Saving stage…' : 'Choose an action to update the stage immediately.'}</Text>
          {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}{error !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
        </View>
        <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push({ pathname: '/admin/crm/[module]/create', params: { module: 'quotes', opportunity: opportunity.id } })} style={styles.outline}><Text style={styles.buttonText}>Create quote</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push({ pathname: '/admin/crm/lead/[id]', params: { id: lead.id } })} style={styles.secondary}><Text style={styles.link}>Related lead</Text></Pressable></View>
        {(opportunity.quotes || []).map(quote => <View key={quote.id} style={styles.card}><Text style={styles.detailValue}>{quote.name}</Text><Text style={styles.subtitle}>{quote.id} · Draft · {money(quote.value)}</Text></View>)}
        {(lead.history || []).some(entry => entry.kind === 'stage') && <View style={styles.card}><Text style={styles.modalTitle}>Stage history</Text>{[...(lead.history || [])].filter(entry => entry.kind === 'stage').reverse().map(entry => <View key={entry.id} style={styles.stageHistoryRow}><Text style={styles.detailValue}>{entry.note}</Text><Text style={styles.subtitle}>{entry.actor || 'Admin'} · {new Date(entry.createdAt).toLocaleString('en-IN')}</Text></View>)}</View>}
      </>}
    </ScrollView><AdminBottomNavigation disabled={saving} />
  </View></SafeAreaView>;
}

type QuoteItemDraft = { key: string; description: string; quantity: string; unitRate: string };
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return isoDate(new Date(year, month - 1, day)) === value;
};

export function NewQuotePage() {
  const { styles } = useAdminLayout(quoteStyles, 'form');
  const router = useRouter();
  const { opportunity: sourceId, edit } = useLocalSearchParams<{ opportunity?: string; edit?: string }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [branch, setBranch] = useState('');
  const { branches: availableBranches, loading: branchesLoading, error: branchesError, refresh: refreshBranches } = useAvailableBranches();
  const [validUntil, setValidUntil] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 7); return isoDate(date); });
  const [items, setItems] = useState<QuoteItemDraft[]>([{ key: 'first', description: '', quantity: '1', unitRate: '0' }]);
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [picker, setPicker] = useState<'customer' | 'branch' | 'date' | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    readLeads().then(records => {
      if (!active) return;
      const customers = records.filter(record => record.opportunity);
      const selected = edit ? customers.find(record => record.opportunity?.quotes?.some(quote => quote.id === edit)) : sourceId ? customers.find(record => record.opportunity?.id === sourceId) : customers[0];
      if (edit && !selected) throw new Error('Quote could not be found.');
      if (sourceId && !selected) throw new Error('Opportunity could not be found.');
      setLeads(customers); setCustomerId(selected?.id || ''); setBranch(selected?.branch || '');
      const existing = selected?.opportunity?.quotes?.find(quote => quote.id === edit);
      if (existing) {
        setItems((existing.items || [{ description: existing.name, quantity: 1, unitRate: existing.value }]).map((item, index) => ({ key: `edit-${index}`, description: item.description, quantity: String(item.quantity), unitRate: String(item.unitRate) })));
        setBranch(existing.branch || selected!.branch); setValidUntil(existing.validUntil || isoDate(new Date()));
        setDiscount(String(existing.discount || 0)); setTaxRate(String(existing.taxRate || 0)); setTerms(existing.terms || '');
      } else if (selected) setItems(current => current.map((item, index) => index === 0 ? { ...item, unitRate: String(selected.opportunity!.estimatedValue) } : item));
    }).catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load customers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sourceId, edit, attempt]);
  const customer = leads.find(lead => lead.id === customerId);
  const branches = availableBranches.map(item => item.name);
  const branchValid = availableBranches.some(item => item.name === branch);
  useEffect(() => {
    if (!branchesLoading && !branchesError && !loading && branch && !branchValid) setBranch('');
  }, [branch, branchValid, branchesLoading, branchesError, loading]);
  const selectCustomer = (value: string) => { if (edit) return; setCustomerId(value); const selected = leads.find(lead => lead.id === value); setBranch(selected?.branch && branches.includes(selected.branch) ? selected.branch : ''); };
  const updateItem = (key: string, field: 'description' | 'quantity' | 'unitRate', value: string) => setItems(current => current.map(item => item.key === key ? { ...item, [field]: value } : item));
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitRate), 0);
  const total = Math.round((subtotal - Number(discount)) * (1 + Number(taxRate) / 100) * 100) / 100;
  const back = () => { if (savingRef.current) return; if (router.canGoBack()) router.back(); else router.replace('/admin/crm/quotes'); };
  const numberValid = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number.isFinite(Number(value));
  const create = async () => {
    if (savingRef.current || loading || loadError) return;
    setError('');
    if (branchesLoading || branchesError || !branchValid) { setError(branchesError || (branchesLoading ? 'Wait for available branches to load.' : 'Choose an available branch before saving the quote.')); return; }
    if (!customer?.opportunity) { setError('Choose a customer with an opportunity.'); return; }
    if (!validIsoDate(validUntil) || validUntil < isoDate(new Date())) { setError('Choose a valid date today or later.'); return; }
    if (items.some(item => !item.description.trim() || !numberValid(item.quantity) || Number(item.quantity) <= 0 || !numberValid(item.unitRate))) { setError('Each line item needs a description, a quantity greater than zero, and a valid unit rate.'); return; }
    if (!numberValid(discount) || Number(discount) > subtotal || !numberValid(taxRate) || Number(taxRate) > 100 || !Number.isFinite(total)) { setError('Enter a discount up to the subtotal and a tax rate between 0 and 100.'); return; }
    savingRef.current = true; setSaving(true);
    try {
      const currentBranches = await getAvailableBranches();
      if (!currentBranches.some(item => item.name === branch)) { refreshBranches(); throw new Error('This branch is no longer available. Choose an available branch.'); }
      const records = await readLeads();
      const current = records.find(lead => lead.id === customerId);
      if (!current?.opportunity) throw new Error('Customer opportunity could not be found.');
      const existing = current.opportunity.quotes?.find(quote => quote.id === edit);
      if (edit && !existing) throw new Error('Quote could not be found.');
      const quote: Quote = { id: existing?.id || `QT-${newLeadId()}`, name: items[0].description.trim(), value: total, createdAt: existing?.createdAt || new Date().toISOString(), customer: current.organisation, branch, validUntil, items: items.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unitRate: Number(item.unitRate) })), discount: Number(discount), taxRate: Number(taxRate), terms: terms.trim(), status: 'Draft' };
      const updated = { ...current, opportunity: { ...current.opportunity, quotes: edit ? current.opportunity.quotes!.map(item => item.id === edit ? quote : item) : [...(current.opportunity.quotes || []), quote] } };
      await AsyncStorage.setItem(leadsKey, JSON.stringify(records.map(lead => lead.id === current.id ? updated : lead)));
      router.replace({ pathname: '/admin/crm/[module]/[id]', params: { module: 'quotes', id: quote.id, saved: '1' } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create quote. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const field = (label: string, value: string, onChangeText: (value: string) => void, numeric = false, multiline = false) => <View style={styles.quoteField}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!saving} style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} /></View>;
  const select = (label: string, value: string, choices: { value: string; label: string }[], kind: 'customer' | 'branch', onChange: (value: string) => void) => {
    const disabled = saving || (!!edit && kind === 'customer') || (kind === 'branch' && (branchesLoading || !!branchesError || !branches.length));
    const placeholder = kind === 'branch' ? 'Choose branch' : 'Choose customer';
    return <View style={styles.quoteField}><Text style={styles.label}>{label}</Text>{Platform.OS === 'web' ? React.createElement('select', { 'aria-label': label, value: choices.some(choice => choice.value === value) ? value : '', disabled, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value), style: { width: '100%', minHeight: 48, borderRadius: 12, padding: '11px 13px', border: '1px solid #dce5f3', background: '#fcfdff', color: '#20334f', fontSize: 14 } }, React.createElement('option', { value: '', disabled: true }, placeholder), choices.map(choice => React.createElement('option', { key: choice.value, value: choice.value }, choice.label))) : <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setPicker(kind)} style={[styles.input, styles.row]}><Text style={[styles.inputText, styles.flex]}>{choices.find(choice => choice.value === value)?.label || placeholder}</Text><AppIcon name="chevron-down" size={18} /></Pressable>}{kind === 'branch' && <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />}</View>;
  };
  const days = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from({ length: Math.ceil((calendarMonth.getDay() + days) / 7) * 7 }, (_, index) => index - calendarMonth.getDay() + 1);

  return <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.page}>

    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={saving} onPress={back} style={styles.back}><AppIcon symbol="‹" style={styles.backGlyph} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>{edit ? 'Edit quote' : 'New quote'}</Text><Text style={styles.subtitle}>A clear price for a clear proposal.</Text></View></View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading quote customers" color="#345cf2" /> : loadError ? <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.edit}><Text style={styles.buttonText}>Retry</Text></Pressable></View> : <View style={styles.card}>
        {leads.length === 0 && <Text style={styles.error}>Create a lead with an opportunity before adding a quote.</Text>}
        {select('Customer', customerId, leads.map(lead => ({ value: lead.id, label: lead.customer?.organisation || lead.organisation })), 'customer', selectCustomer)}
        {select('Branch', branch, branches.map(value => ({ value, label: value })), 'branch', setBranch)}
        <View style={styles.quoteField}><Text style={styles.label}>Valid until *</Text>{Platform.OS === 'web' ? React.createElement('input', { type: 'date', 'aria-label': 'Valid until *', value: validUntil, min: isoDate(new Date()), disabled: saving, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValidUntil(event.target.value), style: { boxSizing: 'border-box', width: '100%', minHeight: 48, borderRadius: 12, padding: '11px 13px', border: '1px solid #dce5f3', background: '#fcfdff', color: '#20334f', fontSize: 14 } }) : <Pressable accessibilityRole="button" accessibilityLabel="Valid until *" disabled={saving} onPress={() => { const [year, month] = validUntil.split('-').map(Number); setCalendarMonth(new Date(year, month - 1, 1)); setPicker('date'); }} style={[styles.input, styles.row]}><Text style={[styles.inputText, styles.flex]}>{validUntil.split('-').reverse().join('/')}</Text><AppIcon symbol="⌄" style={styles.inputText} /></Pressable>}</View>
        {items.map((item, index) => <View key={item.key} style={styles.lineItem}><View style={styles.row}><Text style={[styles.lineTitle, styles.flex]}>Line item {index + 1}</Text>{items.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Remove line item ${index + 1}`} disabled={saving} onPress={() => setItems(current => current.filter(row => row.key !== item.key))} style={styles.remove}><Text style={styles.link}>Remove</Text></Pressable>}</View>{field(`Description *${index ? ` (${index + 1})` : ''}`, item.description, value => updateItem(item.key, 'description', value))}<View style={styles.row}><View style={styles.flex}>{field(`Quantity *${index ? ` (${index + 1})` : ''}`, item.quantity, value => updateItem(item.key, 'quantity', value), true)}</View><View style={styles.flex}>{field(`Unit rate (₹) *${index ? ` (${index + 1})` : ''}`, item.unitRate, value => updateItem(item.key, 'unitRate', value), true)}</View></View></View>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Add line item" disabled={saving} onPress={() => setItems(current => [...current, { key: newLeadId(), description: '', quantity: '1', unitRate: '0' }])} style={styles.addItem}><Text style={styles.buttonText}>+ Add line item</Text></Pressable>
        {field('Discount amount (₹) *', discount, setDiscount, true)}{field('Tax rate (%) *', taxRate, setTaxRate, true)}<Text style={styles.taxHint}>Tax is calculated from the rate you enter.</Text>{field('Terms / note', terms, setTerms, false, true)}{Number.isFinite(total) && <Text style={styles.detailValue}>Quote total · {money(total)}</Text>}
      </View>}
      {error !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </ScrollView><View style={styles.footerActions}><Pressable accessibilityRole="button" disabled={saving} onPress={back} style={styles.cancel}><Text style={styles.buttonText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || loading || !!loadError || !customer || branchesLoading || !!branchesError || !branchValid, busy: saving }} disabled={saving || loading || !!loadError || !customer || branchesLoading || !!branchesError || !branchValid} onPress={() => void create()} style={[styles.create, (saving || loading || !customer || !!loadError || branchesLoading || !!branchesError || !branchValid) && styles.pressed]}><Text style={styles.primaryText}>{saving ? 'Saving…' : edit ? 'Save changes' : 'Create quote'}</Text></Pressable></View><AdminBottomNavigation disabled={saving} />
    <Modal transparent visible={picker !== null} animationType="fade" onRequestClose={() => setPicker(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{picker === 'customer' ? 'Customer' : picker === 'branch' ? 'Branch' : 'Valid until'}</Text><ScrollView>{picker === 'branch' && <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={!branches.length} onRetry={refreshBranches} />}{picker === 'date' ? <><View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() - 1, 1))} style={styles.edit}><AppIcon symbol="‹" style={styles.buttonText} /></Pressable><Text style={[styles.detailValue, styles.flex]}>{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setCalendarMonth(date => new Date(date.getFullYear(), date.getMonth() + 1, 1))} style={styles.edit}><AppIcon symbol="›" style={styles.buttonText} /></Pressable></View><View style={styles.calendarGrid}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <View key={`weekday-${index}`} style={styles.calendarCell}><Text style={styles.caption}>{day}</Text></View>)}{calendarCells.map((day, index) => day < 1 || day > days ? <View key={index} style={styles.calendarCell} /> : <Pressable key={index} accessibilityRole="button" accessibilityLabel={isoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))} disabled={isoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)) < isoDate(new Date())} onPress={() => { setValidUntil(isoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))); setPicker(null); }} style={styles.calendarCell}><Text style={styles.inputText}>{day}</Text></Pressable>)}</View></> : (picker === 'customer' ? leads.map(lead => ({ value: lead.id, label: lead.customer?.organisation || lead.organisation })) : branches.map(value => ({ value, label: value }))).map(choice => <Pressable key={choice.value} accessibilityRole="button" onPress={() => { if (picker === 'customer') selectCustomer(choice.value); else setBranch(choice.value); setPicker(null); }} style={styles.option}><Text style={styles.inputText}>{choice.label}</Text></Pressable>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => setPicker(null)} style={styles.edit}><Text style={styles.buttonText}>Close</Text></Pressable></View></View></Modal>
  </View></KeyboardAvoidingView></SafeAreaView>;
}

const quoteItems = (quote: Quote) => quote.items || [{ description: quote.name, quantity: 1, unitRate: quote.value }];
const dateLabel = (value?: string) => value && validIsoDate(value) ? new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : value || '—';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
function quoteHtml(quote: Quote, customer: string) {
  const items = quoteItems(quote);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
  const discount = quote.discount || 0;
  const tax = Math.round((subtotal - discount) * (quote.taxRate || 0)) / 100;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(quote.id)}</title><style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;color:#20334f;padding:16px}h1{font-size:22px}.badge{color:#7853c8}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:12px 8px;border-bottom:1px solid #e4eaf5;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#f6f8fd}.totals{margin-left:auto;width:65%}.totals p{display:flex;justify-content:space-between;gap:20px}.total{background:#eef7f4;padding:16px;font-weight:bold;color:#138f80}.terms{white-space:pre-wrap;font-size:13px}</style></head><body><p class="badge">${escapeHtml('Draft')}</p><h1>${escapeHtml(currentCompanyName())}</h1><p>QUOTE · ${escapeHtml(quote.id)}</p><p>Prepared for: ${escapeHtml(quote.customer || customer)}</p><p>Valid until: ${escapeHtml(dateLabel(quote.validUntil))}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Rate (₹)</th><th>Total (₹)</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${money(item.unitRate)}</td><td>${money(item.quantity * item.unitRate)}</td></tr>`).join('')}</tbody></table><div class="totals"><p><span>Subtotal</span><span>${money(subtotal)}</span></p><p><span>Discount</span><span>− ${money(discount)}</span></p><p><span>Tax (${quote.taxRate || 0}%)</span><span>${money(tax)}</span></p><p class="total"><span>Total quote</span><span>${money(quote.value)}</span></p></div><p class="terms">${escapeHtml(quote.terms || '')}</p><p>This quote is a locally saved draft. Customer delivery and approval are unavailable here.</p></body></html>`;
}

export function QuotePreviewPage() {
  const { styles } = useAdminLayout(previewStyles, 'detail');
  const router = useRouter();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState(saved === '1' ? 'Quote saved.' : '');
  const [error, setError] = useState('');
  useEffect(() => { if (saved !== '1') return; setNotice('Quote saved.'); const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [id, saved]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    readLeads().then(records => {
      const found = records.find(record => record.opportunity?.quotes?.some(quote => quote.id === id));
      if (!found) throw new Error('Quote could not be found.');
      if (active) setLead(found);
    }).catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load quote.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]));
  const quote = lead?.opportunity?.quotes?.find(item => item.id === id);
  const items = quote ? quoteItems(quote) : [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitRate, 0);
  const discount = quote?.discount || 0;
  const tax = Math.round((subtotal - discount) * (quote?.taxRate || 0)) / 100;
  const savePdf = async () => {
    if (!quote || !lead || busyRef.current) return;
    busyRef.current = true; setBusy(true); setExporting(true); setError(''); setNotice('Preparing PDF…');
    try {
      const html = quoteHtml(quote, lead.organisation);
      if (Platform.OS === 'web') {
        // Open synchronously from the button press so popup blockers allow the preview.
        const printWindow = window.open('', '_blank');
        if (!printWindow) throw new Error('Allow pop-ups for this site, then tap Save PDF again.');
        printWindow.document.write(html);
        printWindow.document.close();
        const printButton = printWindow.document.createElement('button');
        printButton.textContent = 'Save as PDF';
        printButton.addEventListener('click', () => printWindow.print());
        printWindow.document.body.prepend(printButton);
        const printStyle = printWindow.document.createElement('style');
        printStyle.textContent = 'button{padding:12px 20px;background:#345cf2;color:white;border:0;border-radius:8px;cursor:pointer}@media print{button{display:none}}';
        printWindow.document.head.appendChild(printStyle);
        printWindow.focus(); printWindow.print();
        setNotice('Choose Save as PDF in the print dialog.');
      } else {
        const Print = await import('expo-print');
        if (Platform.OS === 'android') {
          const FileSystem = await import('expo-file-system/legacy');
          const file = await Print.printToFileAsync({ html, base64: true });
          if (!file.base64 || file.numberOfPages < 1) throw new Error('The PDF could not be generated.');
          setNotice('Choose a folder to save the PDF.');
          const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (!permission.granted) { setNotice('PDF save cancelled.'); return; }
          const filename = `${quote.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${Date.now()}.pdf`;
          const destination = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, filename, 'application/pdf');
          await FileSystem.writeAsStringAsync(destination, file.base64, { encoding: FileSystem.EncodingType.Base64 });
          setNotice(`PDF saved: ${filename}`);
          Alert.alert('PDF saved', `${filename}\nSaved in the folder you selected.`);
        } else {
          const Sharing = await import('expo-sharing');
          if (!await Sharing.isAvailableAsync()) throw new Error('Saving files is unavailable on this device.');
          const file = await Print.printToFileAsync({ html });
          setNotice('Choose Save to Files in the share sheet.');
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save quote PDF' });
        }
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save the PDF. Please try again.';
      setNotice(''); setError(message);
      if (Platform.OS !== 'web') Alert.alert('Could not save PDF', message);
    }
    finally { busyRef.current = false; setBusy(false); setExporting(false); }
  };
  const summaryRow = (label: string, value: string) => <View style={styles.totalRow}><Text style={styles.totalLabel}>{label}</Text><Text style={styles.totalValue}>{value}</Text></View>;

  return <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}><View style={styles.page}>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back to quotes" disabled={busy} onPress={() => router.push('/admin/crm/quotes')} style={styles.back}><AppIcon symbol="‹" style={styles.backGlyph} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>Quote preview</Text><Text style={styles.subtitle}>{id}</Text></View>{quote && !loading && !loadError && <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push({ pathname: '/admin/crm/[module]/create', params: { module: 'quotes', edit: quote.id } })} style={styles.edit}><Text style={styles.buttonText}>Edit</Text></Pressable>}</View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading quote preview" color="#345cf2" /> : loadError ? <View style={styles.card}><Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.edit}><Text style={styles.buttonText}>Retry</Text></Pressable></View> : quote && lead && <>
        <View style={styles.card}><View style={styles.documentTop}><View style={styles.monogram}><Text style={styles.monogramText}>{currentCompanyName().charAt(0)}</Text></View><View style={[styles.quoteBadge, false && styles.approvedBadge]}><Text style={styles.badgeText}>{'Draft'}</Text></View></View><Text style={styles.issuer}><CompanyName /></Text><Text style={styles.documentId}>QUOTE · {quote.id}</Text><View style={styles.previewMeta}><View style={styles.flex}><Text style={styles.metaLabel}>PREPARED FOR</Text><Text style={styles.metaValue}>{quote.customer || lead.organisation}</Text></View><View style={styles.flex}><Text style={styles.metaLabel}>VALID UNTIL</Text><Text style={styles.metaValue}>{dateLabel(quote.validUntil)}</Text></View></View><View style={styles.divider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.itemTable}><View style={[styles.tableRow, styles.tableHeader]}>{['Description', 'Qty', 'Rate (₹)', 'Total (₹)'].map((label, index) => <Text key={label} style={[styles.tableHeading, index === 0 ? styles.descriptionCell : styles.numericCell]}>{label}</Text>)}</View>{items.map((item, index) => <View key={index} style={styles.tableRow}><Text style={[styles.tableText, styles.descriptionCell]}>{item.description}</Text><Text style={[styles.tableText, styles.numericCell]}>{item.quantity}</Text><Text style={[styles.tableText, styles.numericCell]}>{item.unitRate.toLocaleString('en-IN')}</Text><Text style={[styles.tableText, styles.numericCell]}>{(item.quantity * item.unitRate).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text></View>)}</View></ScrollView>
          {summaryRow('Subtotal', money(subtotal))}{summaryRow('Discount', `− ${money(discount)}`)}{summaryRow(`Tax (${quote.taxRate || 0}%)`, money(tax))}<View style={styles.grandTotal}><Text style={styles.grandTotalText}>Total quote</Text><Text style={styles.grandTotalText}>{money(quote.value)}</Text></View>{quote.terms ? <Text style={styles.terms}>{quote.terms}</Text> : null}
        </View><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Save PDF" accessibilityState={{ disabled: busy, busy: exporting }} disabled={busy} onPress={() => void savePdf()} style={styles.outline}><Text style={styles.buttonText}>{exporting ? "Preparing PDF..." : "Save PDF"}</Text></Pressable></View><View style={styles.info}><AppIcon symbol="ⓘ" style={styles.link} /><Text style={[styles.infoText, styles.flex]}>This quote is a locally saved draft. Customer delivery and approval are unavailable here.</Text></View>{error !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      </>}
    </ScrollView>{notice !== '' && <View pointerEvents="none" style={styles.toast}><Text accessibilityLiveRegion="polite" style={styles.toastText}>{notice}</Text></View>}<AdminBottomNavigation disabled={busy} />
  </View></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  stageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stageAction: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, stageActionPrimary: { backgroundColor: '#345cf2' }, stageActionLost: { backgroundColor: '#fff1f3' }, lostActionText: { color: '#b94d61' }, stageHistoryRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' },
  company: { color: '#20334f', fontSize: 14, fontWeight: '800' }, caption: { color: '#8192ad', fontSize: 9, marginTop: 3 }, search: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f5f7fc', alignItems: 'center', justifyContent: 'center' }, avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#345cf2', fontSize: 12, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 14 }, filter: { flex: 1, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#f7f9ff', borderWidth: 1, borderColor: '#e4eaf5' }, branchFilter: { backgroundColor: '#eaf0ff' }, filterText: { fontSize: 10, color: '#20334f', flexShrink: 1 },
  content: { padding: 16, paddingTop: 22, paddingBottom: 24, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }, back: { width: 36, minHeight: 36, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, backGlyph: { color: '#20334f', fontSize: 25 },
  eyebrow: { fontSize: 9, letterSpacing: 1.3, fontWeight: '700', color: '#71829c' }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', marginTop: 7 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 6 }, edit: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, backgroundColor: '#fff' }, buttonText: { fontSize: 12, color: '#405573', fontWeight: '700' },
  card: { padding: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', borderRadius: 18 }, summaryCard: { backgroundColor: '#eeebfc', paddingVertical: 22 }, summaryLabel: { color: '#345cf2', fontSize: 9, letterSpacing: 1.4, fontWeight: '800' }, opportunityName: { fontSize: 16, color: '#20334f', fontWeight: '700', marginTop: 10 }, amount: { fontSize: 32, fontWeight: '800', color: '#20334f', marginTop: 14, marginBottom: 8 },
  details: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, paddingTop: 14 }, detail: { width: '50%', paddingRight: 10 }, fullDetail: { width: '100%' }, detailLabel: { color: '#71829c', fontSize: 9, letterSpacing: 1, marginBottom: 7 }, detailValue: { color: '#20334f', fontSize: 12, fontWeight: '600', lineHeight: 18 }, divider: { height: 1, backgroundColor: '#edf1f8', marginVertical: 18 }, label: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 8, marginTop: 4 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f', marginBottom: 12 }, inputText: { color: '#20334f', fontSize: 14 }, primary: { minHeight: 44, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center', marginTop: 6 }, primaryText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 0 }, outline: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, secondary: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff' }, link: { color: '#345cf2', fontSize: 12, fontWeight: '600' }, info: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 13, backgroundColor: '#eaf0ff' }, infoText: { fontSize: 11, lineHeight: 18, color: '#607591' },
  notice: { color: '#138f80', fontSize: 12, marginTop: 10 }, error: { color: '#b94d61', fontSize: 12, marginVertical: 10 }, pressed: { opacity: 0.7 }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { color: '#20334f', fontSize: 20, fontWeight: '700', marginBottom: 18 }, option: { minHeight: 48, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#edf1f8' },
});

const quoteStyles = StyleSheet.create({
  ...baseStyles,
  quoteField: { marginBottom: 18, width: '100%' },
  input: { ...baseStyles.input, marginBottom: 0 },
  lineItem: { padding: 12, borderRadius: 13, backgroundColor: '#f6f8fd', marginBottom: 14 },
  lineTitle: { fontSize: 14, color: '#20334f', fontWeight: '700', marginBottom: 12 },
  remove: { minHeight: 44, justifyContent: 'center' },
  addItem: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', justifyContent: 'center', marginBottom: 18 },
  multiline: { minHeight: 68, textAlignVertical: 'top' },
  taxHint: { color: '#71829c', fontSize: 10, lineHeight: 16, marginTop: -12, marginBottom: 20 },
  footerActions: { flexDirection: 'row', gap: 8, padding: 8, marginHorizontal: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, marginBottom: 8 },
  cancel: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f4fa' },
  create: { flex: 1.2, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#345cf2' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 },
  calendarCell: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});

const previewStyles = StyleSheet.create({
  ...baseStyles,
  documentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, monogram: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#5c4ad4', alignItems: 'center', justifyContent: 'center' }, monogramText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  issuer: { fontSize: 16, fontWeight: '800', color: '#20334f', marginTop: 12 }, documentId: { fontSize: 10, color: '#71829c', marginTop: 6 }, quoteBadge: { paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#fff1db', borderRadius: 6 }, approvedBadge: { backgroundColor: '#dff2ec' }, badgeText: { fontSize: 10, color: '#72531f' },
  previewMeta: { flexDirection: 'row', gap: 18, marginTop: 24 }, metaLabel: { fontSize: 9, color: '#71829c', marginBottom: 7 }, metaValue: { fontSize: 12, color: '#20334f', fontWeight: '600' },
  itemTable: { minWidth: 300, flexGrow: 1, borderWidth: 1, borderColor: '#edf1f8', borderRadius: 12, overflow: 'hidden' }, tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: '#edf1f8' }, tableHeader: { backgroundColor: '#f6f8fd' }, descriptionCell: { flex: 2.6, minWidth: 100 }, numericCell: { flex: 1, minWidth: 40, textAlign: 'right' }, tableHeading: { fontSize: 9, color: '#405573', fontWeight: '600' }, tableText: { fontSize: 10, color: '#20334f', lineHeight: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 15 }, totalLabel: { color: '#20334f', fontSize: 12, flexShrink: 1 }, totalValue: { color: '#20334f', fontSize: 12, fontWeight: '700' }, grandTotal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, backgroundColor: '#eef7f4', borderRadius: 13, padding: 16, marginTop: 8 }, grandTotalText: { color: '#138f80', fontSize: 16, fontWeight: '800' }, terms: { fontSize: 12, lineHeight: 19, color: '#71829c', marginTop: 16 },
  approve: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#dff2ec', paddingHorizontal: 10 }, approveText: { fontSize: 12, fontWeight: '700', color: '#138f80', textAlign: 'center' }, footer: { fontSize: 9, color: '#8192ad', textAlign: 'center', marginTop: 22, marginBottom: 12 }, toast: { position: 'absolute', bottom: 82, alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12, backgroundColor: '#20334f' }, toastText: { color: '#fff', fontSize: 12 },
});
