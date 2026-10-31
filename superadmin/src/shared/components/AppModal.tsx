import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import AppButton from './AppButton';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AppModal({ visible, title, message, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}><View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>
        <View style={styles.actions}><AppButton title="Cancel" onPress={onCancel} /><AppButton title="Confirm" destructive onPress={onConfirm} /></View>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000066', padding: spacing.xl },
  card: { width: '100%', maxWidth: 460, padding: spacing.xxl, backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.lg },
  title: { fontSize: typography.section, fontWeight: '700', color: colors.heading },
  message: { fontSize: typography.body, color: colors.text, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
});
