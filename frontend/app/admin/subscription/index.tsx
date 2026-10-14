import { CompanyName, UserInitials } from '../../../src/core/admin/scope';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { useAdminViewport } from '../../../src/ui/useAdminViewport';

const capacity = [
  { label: 'Employees', used: 128, limit: 250 },
  { label: 'Branches', used: 3, limit: 10 },
  { label: 'Companies', used: 1, limit: 3 },
  { label: 'Users', used: 6, limit: 15 },
];
type Dialog = 'plans' | 'cancel' | null;

export default function SubscriptionPage() {
  const router = useRouter();
  const { desktop } = useAdminViewport();
  const { styles, contentWidth } = useAdminLayout(baseStyles, 'detail');
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [dialog, setDialog] = useState<Dialog>(view === 'plans' ? 'plans' : null);
  const [renew, setRenew] = useState(true);
  const cardWidth = contentWidth < 280 ? contentWidth : (contentWidth - 10) / 2;
  const close = () => setDialog(null);
  const openSupport = () => { close(); router.push('/admin/platform-support'); };
  const button = (label: string, onPress: () => void, primary = false) => <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [primary ? styles.primary : styles.secondary, pressed && styles.pressed]}><Text style={primary ? styles.primaryText : styles.buttonText}>{label}</Text></Pressable>;

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    {!desktop && <View style={styles.header}>
      <View style={styles.headerRow}><View style={styles.flex}><Text style={styles.companyName}><CompanyName /> <Text style={styles.down}>{'\u2304'}</Text></Text><Text style={styles.headerCaption}>Business workspace</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my profile" onPress={() => router.push('/admin/profile')} style={styles.avatar}><Text style={styles.avatarText}><UserInitials /></Text></Pressable>
      </View>
      <View style={styles.headerFilters}><View style={styles.headerFilter}><Text style={styles.headerCaption}>Company</Text><Text style={styles.filterText}><CompanyName /></Text><Text style={styles.down}>{'\u2304'}</Text></View><View style={[styles.headerFilter, styles.selectedFilter]}><Text style={styles.headerCaption}>Branch</Text><Text style={styles.filterText}>Vijayawada</Text><Text style={styles.down}>{'\u2304'}</Text></View></View>
    </View>}
    <ScrollView contentContainerStyle={styles.content}>
      <View><Text style={styles.eyebrow}>BRANCHSUITE</Text><Text accessibilityRole="header" style={styles.title}>Your subscription</Text><Text style={styles.subtitle}><CompanyName /> · One licence for this business</Text></View>
      <View style={styles.planCard}><View style={styles.headerRow}><Text style={[styles.planLabel, styles.flex]}>GROWTH PLAN</Text><View style={styles.activeBadge}><Text style={styles.activeText}>Active</Text></View></View><Text style={styles.price}>₹2,499<Text style={styles.priceSuffix}> / month</Text></Text><Text style={styles.planCaption}>{renew ? 'Renews' : 'Ends'} 2026-10-15 · Monthly billing</Text></View>
      <View><Text style={styles.eyebrow}>BRANCHSUITE</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Workspace capacity</Text><Text style={styles.subtitle}>Usage is measured across this business’s companies and branches.</Text></View>
      <View style={styles.capacityGrid}>{capacity.map(item => <View key={item.label} style={[styles.capacityCard, { width: cardWidth }]}><View style={styles.capacityHeading}><Text style={styles.capacityLabel}>{item.label}</Text><Text style={styles.capacityValue}>{item.used} / {item.limit}</Text></View><View accessible accessibilityLabel={`${item.label}: ${item.used} of ${item.limit} used`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: item.limit, now: item.used }} style={styles.track}><View style={[styles.fill, { width: `${item.used / item.limit * 100}%` }]} /></View></View>)}</View>
      <View style={styles.actions}><View style={styles.flex}>{button('Compare / change plan', () => setDialog('plans'), true)}</View><View style={styles.flex}>{button('Billing & invoices', () => router.push('/admin/billing'))}</View></View>
      <View style={styles.renewalCard}><Text accessibilityRole="header" style={styles.sectionTitle}>Renewal preference</Text><Text style={styles.renewalText}>{renew ? 'Your sample subscription is set to renew on 2026-10-15.' : 'Your sample subscription will end on 2026-10-15. You can resume renewal before then.'}</Text>{button(renew ? 'Cancel at renewal' : 'Resume renewal', () => renew ? setDialog('cancel') : setRenew(true))}</View>
      <Pressable accessibilityRole="button" onPress={openSupport} style={({ pressed }) => [styles.support, pressed && styles.pressed]}><Text style={styles.supportText}>Contact platform support</Text></Pressable>
      <Text style={styles.footer}>Offline sample workspace · 3 Oct 2026 · v2.3</Text>
    </ScrollView>
    <AdminBottomNavigation />
  </View><Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={close}><View style={styles.overlay}><View style={styles.modal}><View style={styles.headerRow}><Text accessibilityRole="header" style={[styles.sectionTitle, styles.flex]}>{dialog === 'plans' ? 'Compare / change plan' : dialog === 'cancel' ? 'Cancel at renewal?' : 'Platform support'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close subscription dialog" onPress={close} style={styles.close}><Text style={styles.supportText}>Close</Text></Pressable></View><ScrollView contentContainerStyle={styles.dialogContent}>
    {dialog === 'plans' ? <><Text style={styles.dialogText}>Growth plan · ₹2,499 / month</Text><Text style={styles.subtitle}>250 employees · 10 branches · 3 companies · 15 users</Text><Text style={styles.dialogText}>Need more capacity? Contact platform support to discuss a plan for your business.</Text>{button('Contact platform support', openSupport, true)}</> : dialog === 'cancel' ? <><Text style={styles.dialogText}>Your sample subscription will stay active until 2026-10-15. This changes the demo renewal preference only.</Text>{button('Confirm cancellation', () => { setRenew(false); close(); }, true)}{button('Keep renewal', close)}</> : null}
    </ScrollView></View></View></Modal></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' }, page: { flex: 1, width: '100%', alignSelf: 'center' }, flex: { flex: 1, minWidth: 0 },
  header: { padding: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4eaf5' }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, companyName: { fontSize: 13, fontWeight: '800', color: '#20334f' }, headerCaption: { fontSize: 9, lineHeight: 14, color: '#71829c' }, down: { fontSize: 13, color: '#607591', marginLeft: 'auto' }, avatar: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: '#e4eaf5', backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, fontWeight: '700', color: '#345cf2' }, headerFilters: { flexDirection: 'row', gap: 8, marginTop: 12 }, headerFilter: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, padding: 8, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 8, backgroundColor: '#f7f9ff' }, filterText: { fontSize: 10, fontWeight: '600', color: '#20334f', flexShrink: 1 }, selectedFilter: { backgroundColor: '#eaf0ff', borderColor: '#d5dfff' },
  content: { padding: 16, paddingTop: 22, paddingBottom: 30, gap: 16 }, eyebrow: { fontSize: 8, lineHeight: 12, letterSpacing: 1.5, fontWeight: '700', color: '#71829c' }, title: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: '#20334f', marginTop: 6 }, subtitle: { fontSize: 11, lineHeight: 18, color: '#607591', marginTop: 5 }, sectionTitle: { fontSize: 16, lineHeight: 24, fontWeight: '800', color: '#20334f', marginTop: 4 },
  planCard: { borderWidth: 1, borderColor: '#e2e6fa', borderRadius: 22, padding: 20, backgroundColor: '#edeafa', marginTop: 5, marginBottom: 6 }, planLabel: { fontSize: 9, letterSpacing: 1.5, fontWeight: '800', color: '#345cf2' }, activeBadge: { paddingVertical: 5, paddingHorizontal: 9, backgroundColor: '#dff5eb', borderRadius: 6 }, activeText: { fontSize: 9, fontWeight: '700', color: '#00856d' }, price: { fontSize: 18, lineHeight: 26, fontWeight: '800', color: '#20334f', marginTop: 16 }, priceSuffix: { fontSize: 11, fontWeight: '500', color: '#607591' }, planCaption: { fontSize: 10, lineHeight: 17, color: '#607591', marginTop: 6 },
  capacityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }, capacityCard: { padding: 15, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, backgroundColor: '#fff' }, capacityHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 }, capacityLabel: { fontSize: 10, lineHeight: 16, fontWeight: '700', color: '#20334f' }, capacityValue: { fontSize: 10, lineHeight: 16, color: '#607591' }, track: { height: 4, borderRadius: 2, backgroundColor: '#edf1f7', marginTop: 15, overflow: 'hidden' }, fill: { height: '100%', borderRadius: 2, backgroundColor: '#345cf2' },
  actions: { flexDirection: 'row', gap: 8 }, primary: { minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: '#345cf2', alignItems: 'center', justifyContent: 'center' }, primaryText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#fff', textAlign: 'center' }, secondary: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: '#dce5f3', borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, buttonText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#405573', textAlign: 'center' }, renewalCard: { padding: 18, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 20, backgroundColor: '#fff' }, renewalText: { fontSize: 11, lineHeight: 19, color: '#607591', marginTop: 14, marginBottom: 16 }, support: { minHeight: 44, padding: 12, marginTop: 10, borderRadius: 12, backgroundColor: '#eaf0ff', alignItems: 'center', justifyContent: 'center' }, supportText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#345cf2' }, footer: { fontSize: 9, lineHeight: 16, color: '#8192ad', textAlign: 'center', marginTop: 20, marginBottom: 2 }, pressed: { opacity: 0.7 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21,43,60,0.25)' }, modal: { width: '100%', maxWidth: 460, maxHeight: '85%', backgroundColor: '#fff', padding: 20, borderRadius: 20 }, close: { minHeight: 44, justifyContent: 'center' }, dialogContent: { paddingTop: 14, gap: 12 }, dialogText: { fontSize: 14, lineHeight: 22, color: '#405573' },
});
