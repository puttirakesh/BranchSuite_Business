import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const demoRoles = [
  { title: 'Business Admin', name: 'Neha Iyer', initials: 'NI', branches: 3 },
  { title: 'Company Manager', name: 'Kavitha Reddy', initials: 'KR', branches: 3 },
  { title: 'Sales Executive', name: 'Ravi Teja', initials: 'RT', branches: 1 },
  { title: 'Employee', name: 'Ananya Rao', initials: 'AR', branches: 1 },
  { title: 'Branch Manager', name: 'Kabir Shah', initials: 'KS', branches: 1 },
  { title: 'HR Manager', name: 'Meera Reddy', initials: 'MR', branches: 2 },
  { title: 'Payroll Officer', name: 'Diya Rao', initials: 'DR', branches: 2 },
] as const;

export type DemoRole = typeof demoRoles[number];

export function DemoRolePicker({ visible, onClose, onSelect }: {
  visible: boolean;
  onClose: () => void;
  onSelect: (role: DemoRole) => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mobile = width < 768;

  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={[styles.overlay, mobile && styles.mobileOverlay, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss demo role picker" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.sheet, mobile && styles.mobileSheet]}>
        <View style={styles.handle} />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>Try a demo role</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close demo role picker" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeIcon}>{'\u00d7'}</Text>
          </Pressable>
        </View>
        <Text style={styles.description}>Each role has its own company, branch and module access. Local demo only.</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {demoRoles.map(role => <Pressable key={role.title} accessibilityRole="button" accessibilityLabel={`${role.title}, ${role.name}, ${role.branches} assigned ${role.branches === 1 ? 'branch' : 'branches'}`} onPress={() => onSelect(role)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.avatar}><Text style={styles.initials}>{role.initials}</Text></View>
            <View style={styles.details}>
              <Text style={styles.role}>{role.title}</Text>
              <Text style={styles.caption}>{role.name}{' \u00b7 '}{role.branches} assigned {role.branches === 1 ? 'branch' : 'branches'}</Text>
            </View>
            <View style={styles.chevron} />
          </Pressable>)}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(21, 43, 60, 0.30)' },
  mobileOverlay: { justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 24 },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '85%', paddingHorizontal: 22, paddingBottom: 16, borderRadius: 24, backgroundColor: '#fff', overflow: 'hidden' },
  mobileSheet: { maxWidth: 520 },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#d9e2ef', alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 18, lineHeight: 26, fontWeight: '700', color: '#182d4b' },
  close: { width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: '#7b9bff', backgroundColor: '#f5f8ff', alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 24, lineHeight: 28, fontWeight: '300', color: '#182d4b' },
  description: { fontSize: 12, lineHeight: 19, color: '#607591', marginTop: 12, marginBottom: 16 },
  list: { gap: 9, paddingBottom: 4 },
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 14, borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 15, backgroundColor: '#fff' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#e8eeff', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 12, fontWeight: '700', color: '#345cf2' },
  details: { flex: 1, minWidth: 0 },
  role: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#182d4b' },
  caption: { fontSize: 10, lineHeight: 16, color: '#607591', marginTop: 3 },
  chevron: { width: 8, height: 8, marginRight: 6, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#182d4b', transform: [{ rotate: '45deg' }] },
  pressed: { opacity: 0.65 },
});
