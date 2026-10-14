import { CompanyName, UserInitials } from '../../../src/core/admin/scope';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '../../../src/core/admin/storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

type Branch = { id: string; name: string; code: string; location: string; manager: string; employees: number; active: boolean };
const storageKey = 'branchsuite:branches:v1';
const initialBranches: Branch[] = [];
const emptyBranch: Branch = { id: '', name: '', code: '', location: '', manager: '', employees: 0, active: true };

function BuildingIcon() {
  return <View style={baseStyles.building}><View style={baseStyles.windows}>{[0, 1, 2].map(row => <View key={row} style={baseStyles.windowRow}><View style={baseStyles.window} /><View style={baseStyles.window} /></View>)}</View><View style={baseStyles.buildingSide} /></View>;
}

export default function BranchManagementPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [branches, setBranches] = useState(initialBranches);
  const [selectedId, setSelectedId] = useState('');
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<Branch | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const selected = branches.find(branch => branch.id === selectedId) || branches[0] as Branch | undefined;
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).then(stored => {
      if (!mounted) return;
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(item => item && ['id', 'name', 'code', 'location', 'manager'].every(key => typeof item[key] === 'string') && Number.isInteger(item.employees) && item.employees >= 0 && typeof item.active === 'boolean')) throw new Error('Invalid branch records');
        setBranches(parsed); setSelectedId(current => current || (parsed[0]?.id ?? ''));
      }
      setLoaded(true);
    }).catch(() => { if (mounted) setError('Saved branches could not be loaded. Please reopen this page to try again.'); });
    return () => { mounted = false; };
  }, []);
  const close = () => { if (!saving) { setDraft(null); setPicker(false); setError(''); } };
  const edit = (branch: Branch) => { setError(''); setDraft({ ...branch }); };
  const save = async () => {
    if (!draft || saving || !loaded) return;
    const branch = { ...draft, name: draft.name.trim(), code: draft.code.trim().toUpperCase(), location: draft.location.trim(), manager: draft.manager.trim() };
    if (!branch.name || !branch.code || !branch.location) { setError('Enter a branch name, code and location.'); return; }
    if (branches.some(item => item.id !== branch.id && (item.code.toLowerCase() === branch.code.toLowerCase() || item.name.toLowerCase() === branch.name.toLowerCase()))) { setError('A branch with this name or code already exists.'); return; }
    const next = branch.id ? branches.map(item => item.id === branch.id ? branch : item) : [...branches, { ...branch, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` }];
    setSaving(true);
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setBranches(JSON.parse(await AsyncStorage.getItem(storageKey) || '[]')); setDraft(null); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Branch could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}><CompanyName /> <Text style={styles.muted}>⌄</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Search branches" onPress={() => setSearch(search === null ? '' : null)} style={styles.searchButton}><View style={styles.searchGlass} /></Pressable><View style={styles.avatar}><Text style={styles.avatarText}><UserInitials /></Text></View></View>
      <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}><CompanyName /></Text><Text style={styles.muted}>⌄</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Select branch" onPress={() => setPicker(true)} style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Branch</Text><Text numberOfLines={1} style={[styles.filterText, styles.flex]}>{selected?.name || 'Choose branch'}</Text><Text style={styles.muted}>⌄</Text></Pressable></View>
    </View>}
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back to More" onPress={() => router.replace('/admin/more')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>WORKSPACE</Text><Text style={styles.title}>Branch management</Text><Text style={styles.subtitle}>Company locations, managers and access.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add branch" disabled={!loaded} onPress={() => edit(emptyBranch)} style={[styles.addButton, !loaded && styles.dim]}><Text style={styles.addText}>+ Add</Text></Pressable></View>
      <View style={styles.branchCard}><View style={styles.branchDotHalo}><View style={styles.branchDot} /></View><View style={styles.flex}><Text style={styles.branchTitle}>{selected?.name || 'Choose branch'}</Text><Text style={styles.caption}><CompanyName /> · One branch, every module</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Change branch" onPress={() => setPicker(true)} style={styles.change}><Text style={styles.link}>Change</Text></Pressable></View>
      {search !== null && <TextInput autoFocus accessibilityLabel="Search branches by name or code" placeholder="Search branches by name or code" value={search} onChangeText={setSearch} style={styles.input} />}
      {error && !draft ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.cards}>{branches.filter(branch => search === null || `${branch.name} ${branch.code}`.toLowerCase().includes(search.toLowerCase())).map(branch => <View key={branch.id} style={[styles.card, desktop && styles.desktopCard]}>
        <View style={styles.cardHeader}><View style={styles.buildingIcon}><BuildingIcon /></View><View style={styles.flex}><Text style={styles.cardTitle}>{branch.name}</Text><Text style={styles.caption}>{branch.code} · {branch.location}</Text></View><View style={[styles.badge, !branch.active && styles.inactiveBadge]}><Text style={[styles.statusText, !branch.active && styles.inactiveText]}>{branch.active ? 'Active' : 'Inactive'}</Text></View></View>
        <View style={styles.cardMeta}><Text style={styles.caption}>Manager: {branch.manager || 'Unassigned'}</Text><Text style={styles.caption}>{branch.employees} employees</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${branch.name} branch details`} disabled={!loaded} onPress={() => edit(branch)} style={({ pressed }) => [styles.secondary, pressed && styles.dim]}><Text style={styles.buttonText}>Edit branch details</Text></Pressable>
      </View>)}</View>
      {search !== null && !branches.some(branch => `${branch.name} ${branch.code}`.toLowerCase().includes(search.toLowerCase())) && <Text style={styles.subtitle}>No branches found.</Text>}
    </ScrollView><AdminBottomNavigation />
  </View>
    <Modal transparent visible={picker || draft !== null} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.modalTitle, styles.flex]}>{picker ? 'Choose branch' : draft?.id ? 'Edit branch details' : 'Add branch'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close branch dialog" disabled={saving} onPress={close} style={styles.change}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">
      {picker ? branches.map(branch => <Pressable key={branch.id} accessibilityRole="button" accessibilityState={{ selected: selectedId === branch.id }} onPress={() => { setSelectedId(branch.id); setPicker(false); }} style={[styles.option, selectedId === branch.id && styles.selectedFilter]}><Text style={styles.cardTitle}>{branch.name}</Text><Text style={styles.caption}>{branch.code} · {branch.location}</Text></Pressable>) : draft && <View style={styles.form}>
        {(['name', 'code', 'location', 'manager'] as const).map(key => <View key={key}><Text style={styles.fieldLabel}>{({ name: 'Branch name', code: 'Branch code', location: 'Location', manager: 'Branch manager' })[key]}</Text><TextInput accessibilityLabel={`Branch ${key}`} editable={!saving} value={draft[key]} onChangeText={value => setDraft({ ...draft, [key]: value })} autoCapitalize={key === 'code' ? 'characters' : 'words'} style={styles.input} /></View>)}
        <Text style={styles.fieldLabel}>Status</Text><View style={styles.statusOptions}>{[true, false].map(active => <Pressable key={String(active)} accessibilityRole="button" accessibilityState={{ selected: draft.active === active }} disabled={saving} onPress={() => setDraft({ ...draft, active })} style={[styles.secondary, styles.flex, draft.active === active && styles.selectedFilter]}><Text style={styles.buttonText}>{active ? 'Active' : 'Inactive'}</Text></Pressable>)}</View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={save} style={[styles.addButton, saving && styles.dim]}><Text style={styles.addText}>{saving ? 'Saving…' : 'Save branch'}</Text></Pressable>
      </View>}
    </ScrollView></View></View></Modal>
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, color: '#71829c', lineHeight: 14 }, muted: { color: '#71829c' }, avatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#345cf2', fontSize: 12, fontWeight: '700' }, searchButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f6f8fd', alignItems: 'center', justifyContent: 'center' }, searchGlass: { width: 14, height: 14, borderWidth: 1.5, borderColor: '#20334f', borderRadius: 7 },
  headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, fontWeight: '600', color: '#20334f', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 20, paddingBottom: 24, gap: 16 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, back: { width: 34, minHeight: 34, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 26, color: '#20334f', lineHeight: 28 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#71829c' }, title: { fontSize: 23, lineHeight: 30, fontWeight: '800', color: '#20334f', marginTop: 5 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, addButton: { backgroundColor: '#345cf2', borderRadius: 12, minHeight: 40, paddingHorizontal: 13, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }, addText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  branchCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, backgroundColor: '#fff' }, branchDotHalo: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#dcf5ef', alignItems: 'center', justifyContent: 'center' }, branchDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#39b8a7' }, branchTitle: { fontSize: 11, fontWeight: '700', color: '#20334f' }, caption: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 4 }, change: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 }, link: { fontSize: 11, fontWeight: '700', color: '#345cf2' },
  cards: { gap: 10, flexDirection: 'row', flexWrap: 'wrap' }, card: { width: '100%', padding: 16, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 19, backgroundColor: '#fff' }, desktopCard: { width: '48%', flexGrow: 1 }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f' }, buildingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#dcf5ef', alignItems: 'center', justifyContent: 'center' }, building: { width: 12, height: 16, borderWidth: 1, borderColor: '#008e85', borderBottomWidth: 2 }, windows: { padding: 2, gap: 2 }, windowRow: { flexDirection: 'row', gap: 2 }, window: { width: 2, height: 1, backgroundColor: '#008e85' }, buildingSide: { position: 'absolute', right: -5, bottom: -2, width: 4, height: 11, borderWidth: 1, borderColor: '#008e85' }, badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: '#dff3ea' }, statusText: { fontSize: 9, fontWeight: '700', color: '#08765c' }, inactiveBadge: { backgroundColor: '#edf0f5' }, inactiveText: { color: '#607591' }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 16, marginBottom: 14 }, secondary: { minHeight: 40, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }, buttonText: { fontSize: 12, fontWeight: '600', color: '#405573' },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, option: { minHeight: 60, padding: 12, marginTop: 8, borderRadius: 10 }, form: { gap: 12, marginTop: 16 }, fieldLabel: { fontSize: 12, fontWeight: '600', color: '#405573', marginBottom: 6 }, input: { minHeight: 44, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#20334f', backgroundColor: '#fff' }, statusOptions: { flexDirection: 'row', gap: 8 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, dim: { opacity: 0.6 },
});
