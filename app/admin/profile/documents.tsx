import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

type SampleDocument = { id: string; title: string; content: string };
const storageKey = 'branchsuite:profile-documents:v1';
const employmentLetter: SampleDocument = {
  id: 'sample-employment-letter', title: 'Sample employment letter',
  content: '5 Gen Educon\n\nSAMPLE EMPLOYMENT LETTER\n\nThis sample letter confirms that Admin (EMP0001) is employed as Business Admin with 5 Gen Educon, in the HR department at the Vijayawada branch.\n\nJoining date: 2 June 2025\nReporting manager: Admin1\n\nThis document is generated for demonstration purposes only and is not an official employment or verification record.',
};

export default function DocumentsPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [documents, setDocuments] = useState<SampleDocument[]>([]);
  const [preview, setPreview] = useState<SampleDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey).then(stored => {
      if (!active) return;
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string')) throw new Error('Invalid saved documents');
        setDocuments(parsed);
      }
      setLoaded(true);
    }).catch(() => { if (active) setError('Saved documents could not be loaded. Reopen this page to try again.'); });
    return () => { active = false; };
  }, []);
  const createLetter = async () => {
    if (!loaded || saving) return;
    const existing = documents.find(document => document.id === employmentLetter.id);
    if (existing) { setPreview(existing); return; }
    setSaving(true);
    try {
      const next = [...documents, employmentLetter];
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setDocuments(next); setPreview(employmentLetter); setError('');
    } catch { setError('The sample letter could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}><View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}>5 Gen Educon <Text style={styles.muted}>⌄</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View></View><View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}>5 Gen Educon</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Personal branch</Text><Text style={styles.filterText}>Vijayawada</Text></View></View></View>}
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heading}><Pressable accessibilityRole="button" accessibilityLabel="Back to My profile" onPress={() => router.replace('/admin/profile')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>5 GEN WORKSPACE</Text><Text style={styles.title}>My documents</Text><Text style={styles.subtitle}>Sample documents available on this device.</Text></View></View>
      {!documents.length ? <View style={styles.emptyCard}><View style={styles.emptyIcon}><View style={styles.searchCircle}><View style={styles.searchHandle} /></View></View><Text style={styles.emptyTitle}>{loaded ? 'No documents yet' : 'Loading documents…'}</Text><Text style={styles.emptyCaption}>Sample employment documents can be generated below.</Text></View> : <View style={styles.list}>{documents.map(document => <Pressable key={document.id} accessibilityRole="button" accessibilityLabel={`Open ${document.title}`} onPress={() => setPreview(document)} style={({ pressed }) => [styles.documentCard, pressed && styles.dim]}><View style={styles.emptyIcon}><Text style={styles.documentIcon}>▤</Text></View><View style={styles.flex}><Text style={styles.documentTitle}>{document.title}</Text><Text style={styles.subtitle}>Employment record · Local sample</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={createLetter} style={[styles.secondary, styles.selectedFilter, (!loaded || saving) && styles.dim]}><Text style={styles.link}>{saving ? 'Creating…' : documents.some(document => document.id === employmentLetter.id) ? 'View sample employment letter' : 'Create sample employment letter'}</Text></Pressable>
      <Text style={styles.footer}>Offline sample workspace · Local prototype</Text>
    </ScrollView><AdminBottomNavigation />
  </View><Modal transparent visible={preview !== null} animationType="fade" onRequestClose={() => setPreview(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text style={[styles.modalTitle, styles.flex]}>{preview?.title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close document preview" onPress={() => setPreview(null)} style={styles.change}><Text style={styles.link}>Close</Text></Pressable></View><ScrollView><Text selectable style={styles.letter}>{preview?.content}</Text></ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, muted: { color: '#71829c' }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '800', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, color: '#20334f', fontWeight: '600', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 28, gap: 14 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 8 }, back: { width: 34, minHeight: 34, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 26, lineHeight: 28, color: '#20334f' }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#71829c' }, title: { fontSize: 23, lineHeight: 30, fontWeight: '800', color: '#20334f', marginTop: 5 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, emptyCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, paddingHorizontal: 20, paddingVertical: 26, alignItems: 'center', gap: 8 }, emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, searchCircle: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.4, borderColor: '#345cf2' }, searchHandle: { position: 'absolute', width: 7, height: 1.4, backgroundColor: '#345cf2', right: -5, bottom: -2, transform: [{ rotate: '45deg' }] }, emptyTitle: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: '#20334f', marginTop: 4 }, emptyCaption: { fontSize: 11, lineHeight: 18, color: '#71829c', textAlign: 'center' }, secondary: { minHeight: 42, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', alignItems: 'center', justifyContent: 'center' }, link: { fontSize: 11, fontWeight: '700', color: '#345cf2' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 18 }, list: { gap: 12 }, documentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, backgroundColor: '#fff' }, documentIcon: { color: '#345cf2', fontSize: 22 }, documentTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#20334f' }, chevron: { fontSize: 24, color: '#8192ad' },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 560, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, letter: { fontSize: 14, lineHeight: 24, color: '#405573', paddingTop: 18, paddingBottom: 12 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, dim: { opacity: 0.6 },
});
