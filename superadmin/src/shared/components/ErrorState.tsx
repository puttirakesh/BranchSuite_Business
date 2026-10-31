import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';
import AppButton from './AppButton';

export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.container}><Text accessibilityRole="alert" style={styles.text}>{message}</Text>{onRetry && <AppButton title="Try again" onPress={onRetry} />}</View>;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  text: { color: colors.danger },
});
