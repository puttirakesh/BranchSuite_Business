import { AppIcon } from "./AppIcon";
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAdminViewport } from './useAdminViewport';
import { useAuth } from '../core/auth/AuthProvider';
import { useAdminScope } from '../core/admin/scope';
import { canOpenAdminPath } from '../core/admin/access';

const tabs = [
  { label: 'Home', route: '/admin/dashboard' }, { label: 'CRM', route: '/admin/crm' },
  { label: 'People', route: '/admin/employees/people' }, { label: 'Payroll', route: '/admin/payroll' },
  { label: 'More', route: '/admin/more' },
] as const;

function TabIcon({ label, color }: { label: typeof tabs[number]['label']; color: string }) {
  const names = { Home: 'home', CRM: 'trending-up', People: 'users', Payroll: 'credit-card', More: 'more-horizontal' } as const; return <AppIcon name={names[label]} color={color} size={21} />;
}

export function AdminBottomNavigation({ disabled = false }: { disabled?: boolean }) {
  const { session } = useAuth();
  const scope = useAdminScope();
  const { desktop, keyboardVisible, fontScale } = useAdminViewport();
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname.startsWith('/admin/dashboard') ? 'Home' : pathname.startsWith('/admin/employees') ? 'People' : pathname.startsWith('/admin/payroll') ? 'Payroll' : ['/admin/crm', '/admin/crm/lead-form', '/admin/tasks'].some(prefix => pathname.startsWith(prefix)) ? 'CRM' : 'More';
  if (desktop || keyboardVisible) return null;
  return <View accessibilityLabel="Admin bottom navigation" style={styles.navigation}>{tabs.filter(tab => canOpenAdminPath(session, scope?.companyId, tab.route)).map(tab => {
    const active = tab.label === selected;
    const color = active ? '#345cf2' : '#607591';
    return <Pressable key={tab.label} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={() => router.push(tab.route)} style={({ pressed }) => [styles.item, (pressed || disabled) && styles.dim]}>
      <View accessible={false} style={[styles.icon, active && styles.selected]}><TabIcon label={tab.label} color={color} /></View>
      <Text style={[styles.label, { color, fontSize: fontScale > 1.5 ? 9 : 10 }]}>{tab.label}</Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', flexShrink: 0, paddingHorizontal: 4, paddingTop: 5, paddingBottom: 4, borderTopWidth: 1, borderTopColor: '#e4eaf5', backgroundColor: '#fff' },
  item: { flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 3 },
  icon: { width: 42, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, selected: { backgroundColor: '#eaf0ff' },
  label: { textAlign: 'center', marginTop: 2, flexShrink: 1 }, dim: { opacity: 0.55 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 }, dot: { width: 3, height: 3, borderRadius: 2 },
  person: { width: 18, height: 20, alignItems: 'center' }, head: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.3 }, body: { width: 15, height: 9, borderWidth: 1.3, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginTop: 3 },
  wallet: { width: 18, height: 14, borderRadius: 2, borderWidth: 1.3 }, walletLine: { height: 1, marginTop: 3 }, walletDot: { width: 3, height: 2, marginTop: 3, marginLeft: 11 },
  house: { width: 20, height: 20, alignItems: 'center' }, roof: { width: 12, height: 12, borderLeftWidth: 1.3, borderTopWidth: 1.3, transform: [{ rotate: '45deg' }], position: 'absolute', top: 1 }, houseBody: { width: 12, height: 12, borderLeftWidth: 1.3, borderRightWidth: 1.3, borderBottomWidth: 1.3, marginTop: 7, alignItems: 'center', justifyContent: 'flex-end' }, door: { width: 4, height: 7, borderWidth: 1.3, borderBottomWidth: 0 },
  chart: { width: 20, height: 20, borderLeftWidth: 1.3, borderBottomWidth: 1.3, flexDirection: 'row', gap: 3, alignItems: 'flex-end', paddingLeft: 3, paddingBottom: 2 },
});
