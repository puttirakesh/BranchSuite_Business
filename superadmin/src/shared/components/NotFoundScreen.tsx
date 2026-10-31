import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

export default function NotFoundScreen() {
  return <View style={styles.container}><Text style={styles.title}>Page not found</Text><Link href="/" style={styles.link}>Return to BranchSuite</Link></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  title: { color: colors.heading, fontSize: typography.title, fontWeight: '700' },
  link: { marginTop: spacing.lg, color: colors.primary },
});
