import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

const accents = [
  { label: 'Cobalt + soft blue', color: '#345cf2', soft: '#eaf0ff' },
  { label: 'Teal + soft mint', color: '#008578', soft: '#dff5ef' },
  { label: 'Violet + soft lavender', color: '#7853c8', soft: '#eee7ff' },
] as const;
const storageKey = 'branchsuite:workspace-settings:v1';
type Settings = { name: string; accent: number; companies: string[] };
const defaults: Settings = { name: '5 Gen Educon', accent: 0, companies: ['5 Gen Educon'] };
const modules = [
  { title: 'Companies', caption: 'Add and manage legal/business units.', icon: 'building', color: '#345cf2', soft: '#eaf0ff', route: null },
  { title: 'Branches', caption: 'Locations, branch managers and payroll runs.', icon: 'building', color: '#008578', soft: '#dff5ef', route: '/admin/branches' },
  { title: 'Users & roles', caption: 'Create staff access and assign branches.', icon: 'lock', color: '#7853c8', soft: '#eee7ff', route: '/admin/roles-permissions' },
  { title: 'Subscription', caption: 'Capacity, plan and billing.', icon: 'document', color: '#345cf2', soft: '#eaf0ff', route: '/admin/subscription' },
] as const;

function ModuleIcon({ kind, color }: { kind: string; color: string }) {
  if (kind === 'lock') return <View><View style={[baseStyles.lockTop, { borderColor: color }]} /><View style={[baseStyles.lockBody, { borderColor: color }]} /></View>;
  if (kind === 'document') return <View style={[baseStyles.document, { borderColor: color }]}>{[0, 1, 2].map(line => <View key={line} style={[baseStyles.documentLine, { backgroundColor: color }]} />)}</View>;
  return <View style={[baseStyles.building, { borderColor: color }]}>{[0, 1, 2].map(row => <View key={row} style={baseStyles.iconRow}><View style={[baseStyles.window, { backgroundColor: color }]} /><View style={[baseStyles.window, { backgroundColor: color }]} /></View>)}</View>;
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles, contentWidth } = useAdminLayout(baseStyles, 'detail');
  const [settings, setSettings] = useState<Settings>(defaults);
  const [name, setName] = useState(defaults.name);
  const [accent, setAccent] = useState(0);
  const [dialog, setDialog] = useState<'accent' | 'companies' | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(raw => {
      const saved: Settings = raw ? JSON.parse(raw) : defaults;
      if (!saved || typeof saved.name !== 'string' || !saved.name.trim() || !Number.isInteger(saved.accent) || saved.accent < 0 || saved.accent >= accents.length || !Array.isArray(saved.companies) || !saved.companies.every(company => typeof company === 'string' && company.trim())) throw new Error('Invalid workspace settings');
      if (active) { setSettings(saved); setName(saved.name); setAccent(saved.accent); setLoaded(true); }
    }).catch(() => { if (active) setError('Saved settings could not be loaded. Reopen this page to try again.'); });
    return () => { active = false; };
  }, []);
  const theme = accents[settings.accent];
  const save = async (next: Settings, message: string) => {
    if (!loaded || saving) return;
    setSaving(true); setNotice('');
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setSettings(next); setError(''); setNotice(message); if (dialog === 'companies') setCompanyName(''); }
    catch { setError('Your changes could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const saveBranding = () => {
    if (!name.trim()) { setError('Enter a business display name.'); setNotice(''); return; }
    setName(name.trim()); void save({ ...settings, name: name.trim(), accent }, 'Branding saved.');
  };
  const addCompany = () => {
    const value = companyName.trim();
    if (!value) { setError('Enter a company name.'); return; }
    if (settings.companies.some(company => company.toLowerCase() === value.toLowerCase())) { setError('A company with this name already exists.'); return; }
    void save({ ...settings, companies: [...settings.companies, value] }, 'Company added.');
  };
  const close = () => { if (!saving) { setDialog(null); if (loaded) setError(''); } };
  const visibleModules = modules.filter(module => `${module.title} ${module.caption}`.toLowerCase().includes(query.trim().toLowerCase()));
  const cardWidth = contentWidth < 280 ? contentWidth : (contentWidth - 10) / 2;

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>{settings.name} <Text style={styles.down}>{'\u2304'}</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search workspaces" onPress={() => setSearchOpen(value => !value)} style={styles.searchButton}><View style={styles.searchIcon}><View style={styles.searchHandle} /></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => router.push('/admin/profile')} style={[styles.avatar, { backgroundColor: theme.soft }]}><Text style={[styles.avatarText, { color: theme.color }]}>NI</Text></Pressable></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>{settings.companies[0] || settings.name}</Text><Text style={styles.down}>{'\u2304'}</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Branch</Text><Text style={styles.filterText}>Vijayawada</Text><Text style={styles.down}>{'\u2304'}</Text></View></View></View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View><Text style={styles.eyebrow}>BRANCHSUITE</Text><Text accessibilityRole="header" style={styles.title}>Workspace settings</Text><Text style={styles.subtitle}>Your own brand, business and branches.</Text></View>
      <View style={styles.card}><Text style={styles.label}>Business display name *</Text><TextInput accessibilityLabel="Business display name" value={name} onChangeText={value => { setName(value); setNotice(''); }} editable={loaded && !saving} maxLength={100} style={styles.input} /><Text style={styles.label}>Workspace accent</Text><Pressable accessibilityRole="button" accessibilityLabel={`Workspace accent: ${accents[accent].label}`} disabled={!loaded || saving} onPress={() => setDialog('accent')} style={styles.selector}><Text style={styles.selectorText}>{accents[accent].label}</Text><Text style={styles.down}>{'\u2304'}</Text></Pressable><Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={saveBranding} style={[styles.primary, { backgroundColor: theme.color }, (!loaded || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save branding'}</Text></Pressable>{error && !dialog ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{notice}</Text> : null}</View>
      {(searchOpen || desktop) && <TextInput accessibilityLabel="Search workspaces" placeholder="Search workspaces…" value={query} onChangeText={setQuery} style={styles.input} />}
      <View style={styles.moduleGrid}>{visibleModules.map(module => <Pressable key={module.title} accessibilityRole="button" accessibilityLabel={`Open ${module.title} workspace`} onPress={() => module.route ? router.push(module.route) : setDialog('companies')} style={({ pressed }) => [styles.moduleCard, { width: cardWidth }, pressed && styles.dim]}><View style={styles.moduleBody}><View style={[styles.moduleIcon, { backgroundColor: module.soft }]}><ModuleIcon kind={module.icon} color={module.color} /></View><Text style={styles.moduleTitle}>{module.title}</Text><Text style={styles.moduleCaption}>{module.caption}</Text></View><View style={styles.moduleFooter}><Text style={[styles.openText, { color: theme.color }]}>Open workspace</Text><Text style={[styles.chevron, { color: theme.color }]}>{'\u203a'}</Text></View></Pressable>)}</View>
      {!visibleModules.length && <Text style={styles.subtitle}>No matching workspaces.</Text>}
      <Text style={styles.footer}>Offline sample workspace · 3 Oct 2026 · v2.3</Text>
    </ScrollView><AdminBottomNavigation />
  </View><Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}><View style={styles.headerRow}><Text accessibilityRole="header" style={[styles.modalTitle, styles.flex]}>{dialog === 'accent' ? 'Workspace accent' : 'Companies'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close workspace settings dialog" disabled={saving} onPress={close} style={styles.close}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.dialogContent}>
      {dialog === 'accent' ? accents.map((option, index) => <Pressable key={option.label} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: accent === index }} onPress={() => { setAccent(index); setDialog(null); setNotice(''); }} style={[styles.option, accent === index && styles.selectedFilter]}><View style={[styles.swatch, { backgroundColor: option.color }]} /><Text style={styles.selectorText}>{option.label}</Text></Pressable>) : <><Text style={styles.subtitle}>Legal/business units in your sample workspace.</Text>{settings.companies.map(company => <View key={company} style={styles.option}><Text style={styles.moduleTitle}>{company}</Text></View>)}<Text style={styles.label}>Company name</Text><TextInput accessibilityLabel="Company name" value={companyName} onChangeText={setCompanyName} editable={loaded && !saving} maxLength={100} style={styles.input} /><Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={addCompany} style={[styles.primary, { backgroundColor: theme.color }, (!loaded || saving) && styles.dim]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Add company'}</Text></Pressable><Text style={styles.subtitle}>Changes are saved locally.</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}</>}
    </ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, down: { fontSize: 13, color: '#607591', marginLeft: 'auto' }, avatar: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: '#e4eaf5', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 12 }, headerFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, fontWeight: '600', color: '#20334f', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' }, searchButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f6f8fd', alignItems: 'center', justifyContent: 'center' }, searchIcon: { width: 13, height: 13, borderWidth: 1.3, borderColor: '#20334f', borderRadius: 7 }, searchHandle: { position: 'absolute', width: 7, height: 1.3, backgroundColor: '#20334f', right: -5, bottom: -3, transform: [{ rotate: '45deg' }] },
  content: { padding: 16, paddingTop: 22, paddingBottom: 30, gap: 14 }, eyebrow: { fontSize: 8, lineHeight: 12, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#607591', marginTop: 5 }, card: { padding: 18, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 20, backgroundColor: '#fff', gap: 12, marginTop: 7 }, label: { fontSize: 11, lineHeight: 18, fontWeight: '600', color: '#405573' }, input: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, backgroundColor: '#fbfcff', fontSize: 14, color: '#20334f' }, selector: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, backgroundColor: '#fbfcff', flexDirection: 'row', alignItems: 'center', gap: 8 }, selectorText: { fontSize: 14, lineHeight: 20, color: '#20334f', flexShrink: 1 }, primary: { minHeight: 44, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, moduleCard: { borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 20, backgroundColor: '#fff', overflow: 'hidden' }, moduleBody: { padding: 14, minHeight: 138 }, moduleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, moduleTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f' }, moduleCaption: { fontSize: 10, lineHeight: 17, color: '#607591', marginTop: 5 }, moduleFooter: { borderTopWidth: 1, borderTopColor: '#edf1f8', backgroundColor: '#fbfcff', minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 }, openText: { fontSize: 9, lineHeight: 15, fontWeight: '600' }, chevron: { fontSize: 20, lineHeight: 20 }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 20 },
  building: { width: 13, height: 17, padding: 2, borderWidth: 1, gap: 2 }, iconRow: { flexDirection: 'row', gap: 2 }, window: { width: 2, height: 2 }, lockTop: { width: 8, height: 7, borderWidth: 1, borderTopLeftRadius: 5, borderTopRightRadius: 5, alignSelf: 'center' }, lockBody: { width: 13, height: 10, borderWidth: 1, borderRadius: 2, marginTop: -1 }, document: { width: 14, height: 17, padding: 3, borderWidth: 1, borderRadius: 2, gap: 3 }, documentLine: { width: 6, height: 1 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 20, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: '#20334f' }, close: { minHeight: 44, justifyContent: 'center' }, link: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#345cf2' }, dialogContent: { paddingTop: 14, gap: 12 }, option: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, swatch: { width: 22, height: 22, borderRadius: 7 }, error: { fontSize: 12, lineHeight: 19, color: '#b94d61' }, dim: { opacity: 0.65 },
});
