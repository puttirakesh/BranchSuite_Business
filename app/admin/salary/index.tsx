import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';

type Advance = { id: string; amount: number; reason: string };
const storageKey = 'branchsuite:demo-advances:v1';

export default function SalaryAdvancesPage() {
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [requests, setRequests] = useState<Advance[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(stored => {
      if (!active) return;
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item.id === 'string' && typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0 && typeof item.reason === 'string')) throw new Error('Invalid requests');
        setRequests(parsed);
      }
      setLoaded(true);
    }).catch(() => { if (active) setError('Saved advances could not be loaded. Reopen this page to try again.'); });
    return () => { active = false; };
  }, []);
  const close = () => { if (!saving) { setRequestOpen(false); setError(''); } };
  const submit = async () => {
    if (!loaded || saving) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001 || !reason.trim()) { setError('Enter a positive amount with up to two decimal places and a reason.'); return; }
    const request: Advance = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, amount: value, reason: reason.trim() };
    const next = [...requests, request];
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setRequests(next); setAmount(''); setReason(''); setError(''); setRequestOpen(false);
    } catch { setError('The request could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>5 Gen Educon <Text style={styles.muted}>⌄</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>5 Gen Educon</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Personal branch</Text><Text style={styles.filterText}>Vijayawada</Text></View></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><View style={styles.flex}><Text style={styles.eyebrow}>5 GEN WORKSPACE</Text><Text style={styles.title}>Salary advances</Text><Text style={styles.subtitle}>A simple, trackable request.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Request salary advance" disabled={!loaded} onPress={() => { setError(''); setRequestOpen(true); }} style={[styles.primary, !loaded && styles.dim]}><Text style={styles.primaryText}>+ Request</Text></Pressable></View>
      <View style={styles.notice}><Text style={styles.info}>ⓘ</Text><Text style={styles.noticeText}>Advances are demo requests only. Approval does not transfer money or automatically deduct salary.</Text></View>
      {!requests.length ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><View style={styles.searchCircle}><View style={styles.searchHandle} /></View></View><Text style={styles.emptyTitle}>{loaded ? 'No advances requested' : 'Loading advances…'}</Text><Text style={styles.emptyCaption}>Use Request to create a sample advance.</Text></View> : <View style={styles.list}>{requests.map(request => <View key={request.id} style={styles.card}><View style={styles.headerRow}><Text style={[styles.cardTitle, styles.flex]}>₹{request.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text><View style={styles.badge}><Text style={styles.statusText}>Pending</Text></View></View><Text style={styles.subtitle}>{request.reason}</Text><Text style={styles.caption}>Admin · Vijayawada · Demo request</Text></View>)}</View>}
      {error && !requestOpen ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.footer}>Offline sample workspace · Local prototype</Text>
    </ScrollView><AdminBottomNavigation />
  </View><Modal transparent visible={requestOpen} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.modalTitle, styles.flex]}>Request salary advance</Text><Pressable accessibilityRole="button" accessibilityLabel="Close salary advance request" disabled={saving} onPress={close} style={styles.change}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}><Text style={styles.subtitle}>This sample request is saved on this device.</Text><Text style={styles.fieldLabel}>Amount (INR)</Text><TextInput accessibilityLabel="Salary advance amount" placeholder="Enter amount" keyboardType="decimal-pad" editable={!saving} value={amount} onChangeText={setAmount} style={styles.input} /><Text style={styles.fieldLabel}>Reason</Text><TextInput accessibilityLabel="Salary advance reason" placeholder="Why do you need this advance?" multiline editable={!saving} value={reason} onChangeText={setReason} style={[styles.input, styles.reasonInput]} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={submit} style={[styles.primary, saving && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Submit demo request'}</Text></Pressable></ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, muted: { color: '#71829c' }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '800', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, color: '#20334f', fontWeight: '600', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 28, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#71829c' }, title: { fontSize: 23, lineHeight: 30, fontWeight: '800', color: '#20334f', marginTop: 5 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, primary: { minHeight: 40, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 12, fontWeight: '700', color: '#fff' }, notice: { flexDirection: 'row', gap: 9, backgroundColor: '#eaf0ff', padding: 14, borderRadius: 12 }, info: { color: '#405f9d', fontSize: 16 }, noticeText: { flex: 1, fontSize: 10, lineHeight: 16, color: '#405f9d' }, emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 26, alignItems: 'center', gap: 8 }, emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, searchCircle: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.4, borderColor: '#345cf2' }, searchHandle: { position: 'absolute', width: 7, height: 1.4, backgroundColor: '#345cf2', right: -5, bottom: -2, transform: [{ rotate: '45deg' }] }, emptyTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f', marginTop: 4 }, emptyCaption: { fontSize: 11, lineHeight: 18, color: '#71829c', textAlign: 'center' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 18 }, list: { gap: 12 }, card: { padding: 18, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, backgroundColor: '#fff' }, cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#20334f' }, badge: { backgroundColor: '#fff4da', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { fontSize: 10, color: '#8c681d', fontWeight: '600' }, caption: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 12 },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, link: { fontSize: 11, fontWeight: '700', color: '#345cf2' }, form: { gap: 12, paddingTop: 14, paddingBottom: 4 }, fieldLabel: { fontSize: 12, fontWeight: '600', color: '#405573' }, input: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, fontSize: 14, color: '#20334f' }, reasonInput: { minHeight: 90, textAlignVertical: 'top' }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, dim: { opacity: 0.6 },
});
