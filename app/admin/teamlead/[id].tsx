import React, { useCallback, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leadsKey, newLeadId, readLeads, type Lead, type LeadActivity } from '../../../src/core/leads';

function displayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : value;
}
const currency = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const activityLabel: Record<LeadActivity['kind'], string> = { call: 'Call logged', activity: 'Activity added', edit: 'Lead edited', opportunity: 'Opportunity created', customer: 'Converted to customer' };

export default function LeadDetailsPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [composer, setComposer] = useState<'call' | 'activity' | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setLoadError('');
    readLeads().then(leads => {
      const found = leads.find(item => item.id === id);
      if (!found) throw new Error('Lead could not be found.');
      if (active) setLead(found);
    }).catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load this lead.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]));

  const back = () => {
    if (savingRef.current) return;
    if (router.canGoBack()) router.back(); else router.replace('/admin/dashboard');
  };
  const openComposer = (kind: 'call' | 'activity') => { setComposer(kind); setNote(''); setError(''); setNotice(''); };
  const saveAction = async (kind: LeadActivity['kind']) => {
    if (!lead || savingRef.current) return;
    if ((kind === 'call' || kind === 'activity') && !note.trim()) { setError('Enter a note before saving.'); return; }
    savingRef.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const leads = await readLeads();
      const current = leads.find(item => item.id === id);
      if (!current) throw new Error('Lead could not be found.');
      if (kind === 'opportunity' && current.opportunity) { setLead(current); setNotice('An opportunity already exists for this lead.'); return; }
      if (kind === 'customer' && current.customer) { setLead(current); setNotice('This lead is already a customer.'); return; }
      const createdAt = new Date().toISOString();
      const updated: Lead = { ...current, history: [...(current.history || []), {
        id: newLeadId(), kind, createdAt, note: kind === 'call' || kind === 'activity' ? note.trim() : kind === 'opportunity' ? `Opportunity created for ${current.organisation}.` : `${current.organisation} converted to a customer.`,
      }] };
      if (kind === 'opportunity') updated.opportunity = { id: `OP-${newLeadId()}`, name: current.organisation, estimatedValue: current.estimatedValue, createdAt };
      if (kind === 'customer') {
        updated.customer = { id: `CU-${newLeadId()}`, organisation: current.organisation, contactPerson: current.contactPerson, email: current.email, phone: current.phone, createdAt };
        updated.stage = 'Active';
      }
      await AsyncStorage.setItem(leadsKey, JSON.stringify(leads.map(item => item.id === id ? updated : item)));
      setLead(updated); setComposer(null); setNote(''); setNotice(`${activityLabel[kind]}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save. Please retry.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const detail = (label: string, value: string, full = false) => <View style={[styles.detail, full && styles.fullDetail]}><Text style={styles.detailLabel}>{label}</Text><Text selectable style={styles.detailValue}>{value}</Text></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.row}><View style={styles.flex}><Text style={styles.company}>5 Gen Educon</Text><Text style={styles.caption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>NI</Text></View></View>
          <View style={styles.filters}><View style={styles.filter}><Text style={styles.caption}>Company</Text><Text style={styles.filterText}>5 Gen Educon</Text></View><View style={[styles.filter, styles.branchFilter]}><Text style={styles.caption}>Branch</Text><Text style={styles.filterText}>{lead?.branch || 'Vijayawada'}</Text></View></View>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={saving} onPress={back} style={styles.back}><Text style={styles.backGlyph}>{'\u2039'}</Text></Pressable>
            <View style={styles.flex}><Text style={styles.eyebrow}>5 GEN WORKSPACE</Text><Text style={styles.title}>Lead details</Text>{lead && <Text selectable style={styles.subtitle}>LD-{lead.id}</Text>}</View>
            {lead && !loading && !loadError && <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push({ pathname: '/admin/teamlead', params: { edit: lead.id } })} style={styles.edit}><Text style={styles.buttonText}>Edit</Text></Pressable>}
          </View>
          {loading ? <ActivityIndicator accessibilityLabel="Loading lead" color="#345cf2" style={styles.loading} /> : loadError ? <View style={styles.card}><Text accessibilityLiveRegion="polite" style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View> : lead && <>
            <View style={[styles.card, styles.summaryCard]}>
              <View style={styles.identity}><View style={styles.initial}><Text style={styles.initialText}>{lead.organisation.charAt(0).toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.organisation}>{lead.organisation}</Text><Text style={styles.contact}>{lead.contactPerson}</Text><View style={styles.badge}><Text style={styles.badgeText}>{lead.stage}</Text></View></View></View>
              <View style={styles.divider} />
              <View style={styles.details}>
                {detail('ESTIMATED VALUE', currency(lead.estimatedValue))}
                {detail('OWNER', lead.owner)}
                {detail('SOURCE', lead.source)}
                {detail('BRANCH', lead.branch)}
                {detail('FOLLOW-UP', displayDate(lead.followUpDate), true)}
                {detail('EMAIL', lead.email, true)}
                {detail('PHONE', lead.phone, true)}
                {lead.notes ? detail('NOTES', lead.notes, true) : null}
              </View>
              <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saving} onPress={() => openComposer('call')} style={styles.secondary}><Text style={styles.link}>Log a call</Text></Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={() => openComposer('activity')} style={styles.outline}><Text style={styles.buttonText}>Add activity</Text></Pressable></View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Next step</Text>
              <View style={[styles.actions, styles.nextActions]}><Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !!lead.opportunity }} disabled={saving || !!lead.opportunity} onPress={() => void saveAction('opportunity')} style={[styles.primary, (saving || !!lead.opportunity) && styles.dim]}><Text style={styles.primaryText}>{lead.opportunity ? 'Opportunity created' : 'Create opportunity'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !!lead.customer }} disabled={saving || !!lead.customer} onPress={() => void saveAction('customer')} style={[styles.outline, (saving || !!lead.customer) && styles.dim]}><Text style={styles.buttonText}>{lead.customer ? 'Customer created' : 'Convert to customer'}</Text></Pressable></View>
              {lead.opportunity && <Text selectable style={styles.subtitle}>{lead.opportunity.id}</Text>}
              {lead.customer && <Text selectable style={styles.subtitle}>{lead.customer.id}</Text>}
              {error !== '' && !composer && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
              {notice !== '' && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity history</Text>
              {[...(lead.history || [])].reverse().map(entry => <View key={entry.id} style={styles.historyEntry}><Text style={styles.historyTitle}>{activityLabel[entry.kind] || 'Activity'}</Text><Text style={styles.historyNote}>{entry.note}</Text><Text style={styles.historyDate}>{new Date(entry.createdAt).toLocaleString('en-IN')}</Text></View>)}
            </View>
            <Text style={styles.footer}>Offline sample workspace · v2.3</Text>
          </>}
        </ScrollView>
        <View style={styles.navigation}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.replace('/admin/dashboard')} style={styles.navItem}><Text style={styles.navGlyph}>{'\u2302'}</Text><Text style={styles.navLabel}>Home</Text></Pressable>
          <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.navItem, styles.activeTab]}><Text style={[styles.navGlyph, styles.link]}>{'\u2197'}</Text><Text style={[styles.navLabel, styles.link]}>CRM</Text></View>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => router.push('/admin/employees')} style={styles.navItem}><Text style={styles.navGlyph}>{'\u2659'}</Text><Text style={styles.navLabel}>People</Text></Pressable>
          <View style={styles.navItem}><Text style={styles.navGlyph}>{'\u25a4'}</Text><Text style={styles.navLabel}>Payroll</Text></View><View style={styles.navItem}><Text style={styles.navGlyph}>···</Text><Text style={styles.navLabel}>More</Text></View>
        </View>
      </View>
      <Modal transparent visible={composer !== null} animationType="fade" onRequestClose={() => { if (!savingRef.current) setComposer(null); }}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.row}><Text style={styles.modalTitle}>{composer === 'call' ? 'Log a call' : 'Add activity'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close activity form" disabled={saving} onPress={() => setComposer(null)} style={styles.back}><Text style={styles.backGlyph}>{'\u00d7'}</Text></Pressable></View>
          <Text style={styles.noteLabel}>{composer === 'call' ? 'Call notes *' : 'Activity notes *'}</Text>
          <TextInput accessibilityLabel={composer === 'call' ? 'Call notes' : 'Activity notes'} editable={!saving} value={note} onChangeText={value => { setNote(value); setError(''); }} multiline style={styles.noteInput} />
          {error !== '' && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={() => { if (composer) void saveAction(composer); }} style={[styles.saveButton, saving && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save activity'}</Text></Pressable>
        </View></KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, flex: { flex: 1 }, page: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, company: { fontSize: 14, fontWeight: '800', color: '#20334f' }, caption: { fontSize: 9, color: '#788aa5', marginTop: 4 }, avatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff', borderWidth: 1, borderColor: '#dce5ff' }, avatarText: { fontSize: 13, fontWeight: '700', color: '#345cf2' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 14 }, filter: { flex: 1, minHeight: 34, paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: '#e4eaf7', backgroundColor: '#f7f9ff', flexDirection: 'row', alignItems: 'center', gap: 5 }, filterText: { fontSize: 9, fontWeight: '600', color: '#20334f', flexShrink: 1 }, branchFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingBottom: 34 }, heading: { flexDirection: 'row', gap: 10, marginTop: 6, alignItems: 'flex-start', marginBottom: 10 }, back: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backGlyph: { fontSize: 26, color: '#304560' }, eyebrow: { fontSize: 8, letterSpacing: 1.5, fontWeight: '700', color: '#71829c', marginBottom: 8 }, title: { fontSize: 25, fontWeight: '800', color: '#20334f', letterSpacing: -0.7 }, subtitle: { fontSize: 12, color: '#71829c', marginTop: 6, lineHeight: 19 }, edit: { minHeight: 42, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', justifyContent: 'center' },
  loading: { marginVertical: 40 }, card: { marginTop: 14, padding: 19, borderRadius: 18, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#fff' }, summaryCard: { marginTop: 16 }, cardTitle: { fontSize: 17, fontWeight: '800', color: '#20334f', letterSpacing: -0.4 }, identity: { flexDirection: 'row', gap: 12, alignItems: 'center' }, initial: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, initialText: { color: '#345cf2', fontSize: 20, fontWeight: '800' }, organisation: { fontSize: 18, fontWeight: '800', color: '#20334f' }, contact: { fontSize: 12, color: '#71829c', marginTop: 6 }, badge: { alignSelf: 'flex-start', backgroundColor: '#eef1f6', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, marginTop: 7 }, badgeText: { fontSize: 9, color: '#657995', fontWeight: '600' }, divider: { height: 1, backgroundColor: '#dce5f3', marginVertical: 18 },
  details: { flexDirection: 'row', flexWrap: 'wrap' }, detail: { width: '50%', paddingRight: 10, marginBottom: 20 }, fullDetail: { width: '100%' }, detailLabel: { fontSize: 9, color: '#71829c', letterSpacing: 0.8, marginBottom: 8 }, detailValue: { fontSize: 13, fontWeight: '600', color: '#20334f', lineHeight: 20 }, actions: { flexDirection: 'row', gap: 8 }, nextActions: { marginTop: 16 }, secondary: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#eaf0ff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }, outline: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#dce5f3', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }, buttonText: { fontSize: 12, fontWeight: '700', color: '#405573', textAlign: 'center' }, primary: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#345cf2', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }, primaryText: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' }, link: { color: '#345cf2', fontWeight: '600', fontSize: 12 }, dim: { opacity: 0.55 },
  error: { color: '#b94d61', fontSize: 12, marginTop: 10 }, notice: { fontSize: 12, color: '#34856c', marginTop: 12 }, retry: { minHeight: 44, justifyContent: 'center' }, historyEntry: { borderTopWidth: 1, borderTopColor: '#e4eaf5', marginTop: 16, paddingTop: 14 }, historyTitle: { fontSize: 12, fontWeight: '700', color: '#20334f' }, historyNote: { fontSize: 12, lineHeight: 19, color: '#405573', marginTop: 6 }, historyDate: { fontSize: 10, color: '#71829c', marginTop: 6 }, footer: { textAlign: 'center', fontSize: 9, color: '#8192ad', marginTop: 38 },
  navigation: { flexDirection: 'row', padding: 8, gap: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e4eaf5' }, navItem: { flex: 1, minHeight: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 4 }, navGlyph: { fontSize: 22, color: '#657995' }, navLabel: { fontSize: 9, color: '#657995' }, activeTab: { backgroundColor: '#edf1ff' },
  overlay: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(27,43,68,0.3)' }, modal: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 20, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#20334f' }, noteLabel: { fontSize: 12, fontWeight: '600', color: '#405573', marginTop: 20, marginBottom: 8 }, noteInput: { minHeight: 100, padding: 14, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 13, backgroundColor: '#fcfdff', fontSize: 14, color: '#20334f', textAlignVertical: 'top' }, saveButton: { minHeight: 46, borderRadius: 13, backgroundColor: '#345cf2', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
});
