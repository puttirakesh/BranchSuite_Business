import { AppIcon } from "./AppIcon";
import React, { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminViewport } from './useAdminViewport';
import { useAuth } from '../core/auth/AuthProvider';
import { useAdminScope } from '../core/admin/scope';
import { canOpenAdminPath } from '../core/admin/access';
import { colors } from '../shared/theme/colors';

const tabs = [
  { label: 'Home', route: '/admin/dashboard' }, { label: 'CRM', route: '/admin/crm' },
  { label: 'People', route: '/admin/employees/people' }, { label: 'Payroll', route: '/admin/payroll' },
  { label: 'More', route: '/admin/more' },
] as const;

function TabIcon({ label, color }: { label: typeof tabs[number]['label']; color: string }) {
  const names = { Home: 'home', CRM: 'trending-up', People: 'users', Payroll: 'credit-card', More: 'more-horizontal' } as const; return <AppIcon name={names[label]} color={color} size={21} />;
}

const SharedNavigation = createContext<((owner: symbol, disabled: boolean) => void) | null>(null);

/** Keep one navigation bar alive while the stack changes its page content. */
export function AdminBottomNavigationProvider({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState<Set<symbol>>(() => new Set());
  const register = useCallback((owner: symbol, disabled: boolean) => {
    setBlocked(current => {
      if (current.has(owner) === disabled) return current;
      const next = new Set(current);
      if (disabled) next.add(owner); else next.delete(owner);
      return next;
    });
  }, []);
  return <SharedNavigation.Provider value={register}>
    <SafeAreaView edges={['bottom']} style={styles.frame}>
      <View style={styles.screen}>{children}</View>
      <NavigationContent disabled={blocked.size > 0} />
    </SafeAreaView>
  </SharedNavigation.Provider>;
}

function PageNavigationState({ disabled, register }: { disabled: boolean; register: (owner: symbol, disabled: boolean) => void }) {
  const owner = useRef(Symbol('page-navigation')).current;
  useFocusEffect(useCallback(() => {
    register(owner, disabled);
    return () => register(owner, false);
  }, [disabled, owner, register]));
  return null;
}

export function AdminBottomNavigation({ disabled = false }: { disabled?: boolean }) {
  const shared = useContext(SharedNavigation);
  return shared ? <PageNavigationState disabled={disabled} register={shared} /> : <NavigationContent disabled={disabled} />;
}

function NavigationContent({ disabled }: { disabled: boolean }) {
  const { session } = useAuth();
  const scope = useAdminScope();
  const { webNavigation, fontScale } = useAdminViewport();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  useEffect(() => setPendingRoute(null), [pathname]);
  // Prepare native tab screens only when JS is idle, before the next tap.
  useEffect(() => {
    if (Platform.OS === 'web' || !scope) return;
    const queue = tabs.filter(tab => canOpenAdminPath(session, scope.companyId, tab.route) && tab.route !== pathname);
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (cancelled || !queue.length) return;
      const next = () => {
        if (cancelled) return;
        const tab = queue.shift();
        if (tab) { try { router.prefetch(tab.route); } catch { /* Preloading is optional; navigation still works. */ } }
        schedule();
      };
      if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(next);
      else timer = setTimeout(next, 300);
    };
    schedule();
    return () => { cancelled = true; if (idle !== undefined) cancelIdleCallback(idle); if (timer !== undefined) clearTimeout(timer); };
  }, [router, session, scope?.companyId]);
  const activePath = pendingRoute ?? pathname;
  const selected = activePath.startsWith('/admin/dashboard') ? 'Home' : activePath.startsWith('/admin/employees') ? 'People' : activePath.startsWith('/admin/payroll') ? 'Payroll' : ['/admin/crm', '/admin/crm/lead-form', '/admin/tasks'].some(prefix => activePath.startsWith(prefix)) ? 'CRM' : 'More';
  if (webNavigation) return null;
  return <View accessibilityLabel="Admin bottom navigation" style={styles.navigation}>{tabs.filter(tab => canOpenAdminPath(session, scope?.companyId, tab.route)).map(tab => {
    const active = tab.label === selected;
    const color = active ? colors.primary : colors.muted;
    return <Pressable key={tab.label} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: active, disabled }} aria-selected={active} disabled={disabled} onPress={() => {
      if (pathname.replace(/\/$/, '') === tab.route || pendingRoute === tab.route) return;
      setPendingRoute(tab.route);
      startTransition(() => router.navigate(tab.route));
    }} style={({ pressed }) => [styles.item, (pressed || disabled) && styles.dim]}>
      <View accessible={false} style={[styles.icon, active && styles.selected]}><TabIcon label={tab.label} color={color} /></View>
      <Text style={[styles.label, { color, fontSize: fontScale > 1.5 ? 9 : 10 }]}>{tab.label}</Text>
    </Pressable>;
  })}</View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, minWidth: 0, backgroundColor: colors.background },
  screen: { flex: 1, minHeight: 0, minWidth: 0 },
  navigation: { flexDirection: 'row', flexShrink: 0, paddingHorizontal: 4, paddingTop: 5, paddingBottom: 4, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  item: { flex: 1, minWidth: 0, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, paddingVertical: 3 },
  icon: { width: 42, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, selected: { backgroundColor: colors.primaryLight },
  label: { textAlign: 'center', marginTop: 2, flexShrink: 1 }, dim: { opacity: 0.55 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 }, dot: { width: 3, height: 3, borderRadius: 2 },
  person: { width: 18, height: 20, alignItems: 'center' }, head: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.3 }, body: { width: 15, height: 9, borderWidth: 1.3, borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginTop: 3 },
  wallet: { width: 18, height: 14, borderRadius: 2, borderWidth: 1.3 }, walletLine: { height: 1, marginTop: 3 }, walletDot: { width: 3, height: 2, marginTop: 3, marginLeft: 11 },
  house: { width: 20, height: 20, alignItems: 'center' }, roof: { width: 12, height: 12, borderLeftWidth: 1.3, borderTopWidth: 1.3, transform: [{ rotate: '45deg' }], position: 'absolute', top: 1 }, houseBody: { width: 12, height: 12, borderLeftWidth: 1.3, borderRightWidth: 1.3, borderBottomWidth: 1.3, marginTop: 7, alignItems: 'center', justifyContent: 'flex-end' }, door: { width: 4, height: 7, borderWidth: 1.3, borderBottomWidth: 0 },
  chart: { width: 20, height: 20, borderLeftWidth: 1.3, borderBottomWidth: 1.3, flexDirection: 'row', gap: 3, alignItems: 'flex-end', paddingLeft: 3, paddingBottom: 2 },
});
