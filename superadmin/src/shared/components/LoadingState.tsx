import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export default function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return <View style={styles.container} accessibilityRole="progressbar"><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.text}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  text: { color: colors.muted, marginTop: spacing.md },
});
