import { Link, Redirect, Stack, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../core/auth/AuthContext';
import { navigationForRole } from '../../core/config/navigation';
import { homeForRole, type PlatformRole } from '../../core/permissions/roles';
import { breakpoints, colors, spacing, typography } from '../../theme/tokens';
import AppButton from './AppButton';

export default function WorkspaceLayout({ role }: { role: PlatformRole }) {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const wide = width >= breakpoints.sidebar;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== role) return <Redirect href={homeForRole(user.role)} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.identity}><Text style={styles.brand}>BranchSuite</Text><Text style={styles.account}>{user.name} · {role === 'PLATFORM_ADMIN' ? 'Admin' : 'Support'}</Text></View>
        <AppButton title="Log Out" destructive onPress={() => { void logout(); }} />
      </View>
      <View style={[styles.body, wide && styles.wideBody]}>
        <ScrollView horizontal={!wide} style={wide ? styles.sidebar : styles.mobileNavigation} contentContainerStyle={styles.links}>
          {navigationForRole(role).map(({ label, href }) => {
            const path = href.replace(/\/\([^/]+\)/, '');
            const selected = pathname === path || pathname.startsWith(`${path}/`);
            return <Link key={href} href={href} accessibilityRole="link" accessibilityState={{ selected }} style={[styles.link, selected && styles.selected]}>{label}</Link>;
          })}
        </ScrollView>
        <View style={styles.content}><Stack screenOptions={{ headerShown: false }} /></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  identity: { flex: 1 },
  brand: { color: colors.primary, fontSize: typography.section, fontWeight: '800' },
  account: { color: colors.muted, fontSize: typography.caption, marginTop: spacing.xs },
  body: { flex: 1 },
  wideBody: { flexDirection: 'row' },
  sidebar: { width: 190, flexGrow: 0, backgroundColor: colors.surface },
  mobileNavigation: { flexGrow: 0, backgroundColor: colors.surface },
  links: { padding: spacing.sm, gap: spacing.xs },
  link: { padding: spacing.md, color: colors.muted, fontWeight: '600' },
  selected: { color: colors.primary, backgroundColor: colors.background, borderRadius: 10 },
  content: { flex: 1, minWidth: 0 },
});
