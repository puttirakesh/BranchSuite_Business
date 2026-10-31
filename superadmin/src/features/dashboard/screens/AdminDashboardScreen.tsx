import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../core/auth/AuthContext';
import { colors, radii, spacing, typography } from '../../../theme/tokens';

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>BranchSuite SuperAdmin</Text>
        <Text style={styles.subtitle}>Platform dashboard</Text>
        <Text style={styles.welcome}>Welcome, {user?.name}</Text>
        <Text style={styles.subtitle}>Role: {user?.role}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 30, width: '100%', maxWidth: 460, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  title: { fontSize: typography.title, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: { fontSize: typography.body, color: colors.muted, marginTop: spacing.md, textAlign: 'center' },
  welcome: { fontSize: typography.section, fontWeight: '700', color: colors.text, marginTop: spacing.xxl },
});
