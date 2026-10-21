import { AppIcon } from '../../../src/ui/AppIcon';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { CompanyName, useAdminScope } from '../../../src/core/admin/scope';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '../../../src/core/admin/storage';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';
import { getAdminScope } from '../../../src/core/admin/scope';
import { workspacePreferencesApi } from '../../../src/core/admin/api';

type Dialog = 'settings' | 'help' | 'signout' | null;
const settingsKey = 'branchsuite:profile-settings:v1';

export default function ProfilePage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const { signOut } = useAuth();
  const scope = useAdminScope();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [compact, setCompact] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      const scope = await getAdminScope();
      const remote = await workspacePreferencesApi.read(scope.companyId, 'profile');
      let raw = remote?.value ? JSON.stringify(remote.value) : null;
      if (!raw) {
        raw = await AsyncStorage.getItem(settingsKey);
        if (raw) {
          const legacy = JSON.parse(raw);
          await workspacePreferencesApi.save(scope.companyId, 'profile', { compact: legacy.compact === true });
          await AsyncStorage.removeItem(settingsKey);
        }
      }
      if (!active) return;
      if (raw) setCompact(JSON.parse(raw).compact === true);
      setLoaded(true);
    })().catch(() => { if (active) setError('Preferences could not be loaded.'); });
    return () => { active = false; };
  }, []);
  const close = () => { if (!saving) setDialog(null); };
  const saveSettings = async () => {
    if (!loaded || saving) return;
    setSaving(true); setError('');
    try { const current = await getAdminScope(); await workspacePreferencesApi.save(current.companyId, 'profile', { compact }); setDialog(null); }
    catch { setError('Preferences could not be saved. Please try again.'); }
    finally { setSaving(false); }
  };
  const leave = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try { await signOut(); router.replace('/auth/login'); }
    catch { setError('Sign out failed. Please try again.'); }
    finally { setSaving(false); }
  };
  const role = scope?.role.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, value => value.toUpperCase()) || '';
  const detail = (label: string, value: string) => <View style={styles.fullDetail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value || 'Unavailable'}</Text></View>;
  const menu = [
    { title: 'My documents', caption: 'Employment and verification records', icon: 'file-text' as const, open: () => router.push('/admin/profile/documents') },
    { title: 'App settings', caption: 'Display preferences', icon: 'settings' as const, open: () => setDialog('settings') },
    { title: 'Help', caption: 'Using your workspace', icon: 'help-circle' as const, open: () => setDialog('help') },
  ];
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}><View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <AdminPageHeading title="My profile" />
      <View style={[styles.card, compact && styles.compactCard]}>
        <View style={styles.profileHeading}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{scope?.user.name.charAt(0).toUpperCase() || ''}</Text></View><View style={styles.flex}><Text style={styles.profileName}>{scope?.user.name || 'Loading profile...'}</Text><Text style={styles.subtitle}>{role} / <CompanyName /></Text></View></View>
        <View style={styles.details}>{detail('EMAIL', scope?.user.email || '')}{detail('BRANCHES', scope?.branches.map(branch => branch.name).join(', ') || '')}</View>
      </View>
      <View style={styles.group}>{menu.map((item, index) => <Pressable key={item.title} accessibilityRole="button" onPress={item.open} style={[styles.row, index > 0 && styles.rowDivider, compact && styles.compactRow]}><AppIcon name={item.icon} size={20} color="#607591" /><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.caption}>{item.caption}</Text></View><AppIcon name="chevron-right" size={20} /></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => setDialog('signout')} style={styles.secondary}><Text style={styles.buttonText}>Sign out</Text></Pressable>
      {error && !dialog ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>{!desktop && <AdminBottomNavigation />}
    </View><Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View style={styles.modal}>
      <View style={styles.headerRow}><Text style={[styles.modalTitle, styles.flex]}>{dialog === 'settings' ? 'App settings' : dialog === 'help' ? 'Help' : 'Sign out'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close profile dialog" disabled={saving} onPress={close} style={styles.change}><Text style={styles.link}>Close</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.dialogContent}>
        {dialog === 'settings' ? <><View style={styles.settingRow}><Text style={[styles.dialogText, styles.flex]}>Compact profile display</Text><Switch accessibilityLabel="Compact profile display" value={compact} disabled={saving} onValueChange={setCompact} /></View><Pressable accessibilityRole="button" disabled={!loaded || saving} onPress={() => void saveSettings()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save preferences'}</Text></Pressable></> : dialog === 'help' ? <><Text style={styles.dialogText}>Use the workspace navigation to open CRM, People, Payroll and More.</Text><Text style={styles.dialogText}>Manage locations in Branch management and account access in Roles & branch access.</Text></> : dialog === 'signout' ? <><Text style={styles.dialogText}>Sign out of BranchSuite on this device?</Text><Pressable accessibilityRole="button" disabled={saving} onPress={() => void leave()} style={styles.primary}><Text style={styles.primaryText}>{saving ? 'Signing out...' : 'Sign out'}</Text></Pressable></> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', maxWidth: 1280, alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 }, header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, muted: { color: '#71829c' }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '800', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 14 }, headerFilter: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, color: '#20334f', fontWeight: '600', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 28, gap: 14 }, eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: '#71829c' }, title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#71829c', marginTop: 4 }, card: { padding: 18, marginTop: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, backgroundColor: '#fff' }, compactCard: { padding: 12 }, profileHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, profileAvatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, profileInitial: { fontSize: 19, fontWeight: '800', color: '#345cf2' }, profileName: { fontSize: 16, fontWeight: '800', color: '#20334f' }, employeeBadge: { alignSelf: 'flex-start', backgroundColor: '#eee7fa', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, marginTop: 4 }, employeeCode: { color: '#6541a0', fontSize: 9 }, details: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, borderTopWidth: 1, borderTopColor: '#e4eaf5', marginTop: 14, paddingTop: 16, paddingBottom: 12 }, detail: { width: '50%' }, fullDetail: { width: '100%' }, detailLabel: { fontSize: 9, letterSpacing: 0.7, color: '#71829c' }, detailValue: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#20334f', marginTop: 6 },
  group: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 18, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 74, padding: 16 }, compactRow: { minHeight: 58, paddingVertical: 10 }, rowDivider: { borderTopWidth: 1, borderTopColor: '#edf1f8' }, rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 18, color: '#607eb2' }, rowTitle: { fontSize: 12, fontWeight: '700', color: '#20334f' }, caption: { fontSize: 10, lineHeight: 16, color: '#71829c', marginTop: 6 }, chevron: { fontSize: 24, color: '#8192ad' }, secondary: { minHeight: 42, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dce5f3', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, buttonText: { fontSize: 12, fontWeight: '600', color: '#405573' }, link: { fontSize: 11, fontWeight: '700', color: '#345cf2' }, back: { padding: 8, alignItems: 'center' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 8 },
  overlay: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', padding: 20, borderRadius: 18, backgroundColor: '#fff' }, modalTitle: { fontSize: 18, fontWeight: '700', color: '#20334f' }, change: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, dialogContent: { gap: 12, paddingTop: 14, paddingBottom: 4 }, dialogText: { fontSize: 14, lineHeight: 22, color: '#405573' }, fieldLabel: { fontSize: 12, fontWeight: '600', color: '#405573' }, input: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 10, fontSize: 14, color: '#20334f' }, primary: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' }, request: { padding: 12, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 10 }, settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, error: { fontSize: 13, lineHeight: 20, color: '#b94d61' }, dim: { opacity: 0.6 },
});
