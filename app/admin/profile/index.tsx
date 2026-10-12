import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

type Dialog = 'documents' | 'advance' | 'settings' | 'help' | 'role' | 'signout' | null;
type Advance = { id: string; amount: number; reason: string };
const menu = [
  { title: 'My documents', caption: 'Employment and verification records', dialog: 'documents', icon: '▤' },
  { title: 'Salary advance', caption: 'Submit and track a demo request', dialog: 'advance', icon: '▣' },
  { title: 'App settings', caption: 'Display and notification preferences', dialog: 'settings', icon: '⚙' },
  { title: 'Help & demo guide', caption: 'How to try the prototype', dialog: 'help', icon: 'ⓘ' },
] as const;
const settingsKey = 'branchsuite:profile-settings:v1';
const advanceKey = 'branchsuite:demo-advances:v1';

export default function ProfilePage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);
  const [requests, setRequests] = useState<Advance[]>([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState('Business Admin');
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(settingsKey), AsyncStorage.getItem(advanceKey)]).then(([savedSettings, savedRequests]) => {
      if (!active) return;
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (typeof settings.notifications !== 'boolean' || typeof settings.compact !== 'boolean') throw new Error('Invalid settings');
        setNotifications(settings.notifications); setCompact(settings.compact);
      }
      if (savedRequests) {
        const parsed: unknown = JSON.parse(savedRequests);
        if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item.id === 'string' && typeof item.amount === 'number' && Number.isFinite(item.amount) && item.amount > 0 && typeof item.reason === 'string')) throw new Error('Invalid requests');
        setRequests(parsed);
      }
      setLoaded(true);
    }).catch(() => { if (active) setError('Saved profile preferences could not be loaded. Reopen this page to try again.'); });
    return () => { active = false; };
  }, []);
  const open = (value: Dialog) => {
    if (value === 'documents') { router.push('/admin/profile/documents'); return; }
    if (value === 'advance') { router.push('/admin/salary'); return; }
    if (loaded) setError('');
    setDialog(value);
  };
  const close = () => { if (!saving) { setDialog(null); if (loaded) setError(''); } };
  const saveSettings = async () => {
    if (!loaded || saving) return;
    setSaving(true);
    try { await AsyncStorage.setItem(settingsKey, JSON.stringify({ notifications, compact })); setError(''); setDialog(null); }
    catch { setError('Preferences could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const submitAdvance = async () => {
    if (!loaded || saving) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !reason.trim()) { setError('Enter a positive amount and a reason.'); return; }
    const next = [...requests, { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, amount: value, reason: reason.trim() }];
    setSaving(true);
    try { await AsyncStorage.setItem(advanceKey, JSON.stringify(next)); setRequests(next); setAmount(''); setReason(''); setError(''); }
    catch { setError('Request could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const detail = (label: string, value: string, full = false) => <View style={full ? styles.fullDetail : styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>5 Gen Educon <Text style={styles.muted}>⌄</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>5 Gen Educon</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Personal branch</Text><Text style={styles.filterText}>Vijayawada</Text></View></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View><Text style={styles.eyebrow}>5 GEN WORKSPACE</Text><Text style={styles.title}>My profile</Text><Text style={styles.subtitle}>Your details. Your workspace.</Text></View>
      <View style={[styles.card, compact && styles.compactCard]}><View style={styles.profileHeading}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>A</Text></View><View style={styles.flex}><Text style={styles.profileName}>Admin</Text><Text style={styles.subtitle}>{role} · 5 Gen Educon</Text><View style={styles.employeeBadge}><Text style={styles.employeeCode}>EMP0001</Text></View></View></View><View style={styles.details}>{detail('DEPARTMENT', 'HR')}{detail('MANAGER', 'Admin1')}{detail('BRANCH', 'Vijayawada', true)}{detail('EMAIL', 'admin@demo.example', true)}{detail('PHONE', '+91 90000 10001')}{detail('JOINED', '2 Jun 2025')}</View></View>
      <View style={styles.group}>{menu.map((item, index) => <Pressable key={item.dialog} accessibilityRole="button" onPress={() => open(item.dialog)} style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, compact && styles.compactRow, pressed && styles.dim]}><View style={styles.rowIcon}><Text style={styles.iconText}>{item.icon}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.caption}>{item.caption}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>
      {error && !dialog ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => open('role')} style={[styles.secondary, styles.selectedFilter]}><Text style={styles.link}>Switch demo role</Text></Pressable><Pressable accessibilityRole="button" onPress={() => open('signout')} style={styles.secondary}><Text style={styles.buttonText}>Sign out</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.replace('/admin/more')} style={styles.back}><Text style={styles.link}>Back to More</Text></Pressable><Text style={styles.footer}>Offline sample workspace · Local prototype</Text>
    </ScrollView><AdminBottomNavigation />
  </View><Modal transparent visible={dialog !== null || signedOut} animationType="fade" onRequestClose={signedOut ? undefined : close}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.modalTitle, styles.flex]}>{signedOut ? 'Demo session ended' : dialog === 'role' ? 'Switch demo role' : dialog === 'signout' ? 'Sign out' : menu.find(item => item.dialog === dialog)?.title}</Text>{!signedOut && <Pressable accessibilityRole="button" accessibilityLabel="Close profile dialog" disabled={saving} onPress={close} style={styles.change}><Text style={styles.link}>Close</Text></Pressable>}</View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
    {signedOut ? <><Text style={styles.dialogText}>You have left the local demo session.</Text><Pressable accessibilityRole="button" onPress={() => { setSignedOut(false); setRole('Business Admin'); setDialog(null); router.replace('/admin/dashboard'); }} style={styles.primary}><Text style={styles.primaryText}>Start demo again</Text></Pressable></> : dialog === 'documents' ? <><Text style={styles.dialogText}>Employment and verification records</Text><Text style={styles.subtitle}>No documents have been uploaded for this sample profile.</Text></> : dialog === 'advance' ? <>
      <Text style={styles.subtitle}>Demo requests are saved on this device.</Text><Text style={styles.fieldLabel}>Amount (INR)</Text><TextInput accessibilityLabel="Salary advance amount" editable={!saving} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} style={styles.input} /><Text style={styles.fieldLabel}>Reason</Text><TextInput accessibilityLabel="Salary advance reason" editable={!saving} multiline value={reason} onChangeText={setReason} style={styles.input} /><Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={submitAdvance} style={[styles.primary, (!loaded || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Submit demo request'}</Text></Pressable><Text style={styles.fieldLabel}>My requests</Text>{requests.length ? requests.map(request => <View key={request.id} style={styles.request}><Text style={styles.rowTitle}>₹{request.amount.toLocaleString('en-IN')} · Pending (demo)</Text><Text style={styles.subtitle}>{request.reason}</Text></View>) : <Text style={styles.subtitle}>No requests yet.</Text>}
    </> : dialog === 'settings' ? <><View style={styles.settingRow}><Text style={[styles.dialogText, styles.flex]}>Demo notifications</Text><Switch accessibilityLabel="Demo notifications" value={notifications} disabled={saving} onValueChange={setNotifications} /></View><Text style={styles.subtitle}>Stores your preference for the demo.</Text><View style={styles.settingRow}><Text style={[styles.dialogText, styles.flex]}>Compact profile display</Text><Switch accessibilityLabel="Compact profile display" value={compact} disabled={saving} onValueChange={setCompact} /></View><Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={saveSettings} style={[styles.primary, (!loaded || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save preferences'}</Text></Pressable></> : dialog === 'help' ? <><Text style={styles.dialogText}>Use the bottom navigation to explore Home, CRM, People, Payroll and More.</Text><Text style={styles.dialogText}>Manage locations in Branch management and try role assignments in Roles & branch access.</Text><Text style={styles.dialogText}>This profile contains sample details. Salary advance requests and preferences are stored locally.</Text></> : dialog === 'role' ? <><Text style={styles.subtitle}>Choose a role to preview on this profile.</Text>{['Business Admin', 'Company Manager', 'HR Manager', 'Payroll Officer'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: role === value }} onPress={() => { setRole(value); close(); }} style={[styles.secondary, role === value && styles.selectedFilter]}><Text style={styles.buttonText}>{value}</Text></Pressable>)}</> : dialog === 'signout' ? <><Text style={styles.dialogText}>End this local demo session? Your saved records will remain on this device.</Text><Pressable accessibilityRole="button" onPress={() => { setSignedOut(true); setDialog(null); }} style={styles.primary}><Text style={styles.primaryText}>Sign out of demo</Text></Pressable></> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, muted: { color: '#71829c' }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '800', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, color: '#20334f', fontWeight: '600', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 28, gap: 14 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#71829c' }, title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, card: { padding: 18, marginTop: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, backgroundColor: '#fff' }, compactCard: { padding: 12 }, profileHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, profileAvatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, profileInitial: { fontSize: 19, fontWeight: '800', color: '#345cf2' }, profileName: { fontSize: 16, fontWeight: '800', color: '#20334f' }, employeeBadge: { alignSelf: 'flex-start', backgroundColor: '#eee7fa', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 }, employeeCode: { color: '#6541a0', fontSize: 9 }, details: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, borderTopWidth: 1, borderTopColor: '#e4eaf5', marginTop: 14, paddingTop: 16, paddingBottom: 12 }, detail: { width: '50%' }, fullDetail: { width: '100%' }, detailLabel: { fontSize: 9, letterSpacing: 0.7, color: '#71829c' }, detailValue: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#20334f', marginTop: 6 },
  group: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 74, padding: 16 }, compactRow: { minHeight: 58, paddingVertical: 10 }, rowDivider: { borderTopWidth: 1, borderTopColor: '#edf1f8' }, rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 18, color: '#607eb2' }, rowTitle: { fontSize: 12, fontWeight: '700', color: '#20334f' }, caption: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 6 }, chevron: { fontSize: 24, color: '#8192ad' }, secondary: { minHeight: 42, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, buttonText: { fontSize: 12, fontWeight: '600', color: '#405573' }, link: { fontSize: 11, fontWeight: '700', color: '#345cf2' }, back: { padding: 8, alignItems: 'center' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 8 },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, dialogContent: { gap: 12, paddingTop: 14, paddingBottom: 4 }, dialogText: { fontSize: 14, lineHeight: 22, color: '#405573' }, fieldLabel: { fontSize: 12, fontWeight: '600', color: '#405573' }, input: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, fontSize: 14, color: '#20334f' }, primary: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, request: { padding: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10 }, settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, dim: { opacity: 0.6 },
});
