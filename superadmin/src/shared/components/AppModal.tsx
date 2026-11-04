import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../theme/tokens';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Button } from './AppButton';

/**
 * APK `.modal`: bottom sheet with a drag handle on phones, centred dialog on wider
 * screens. Content scrolls and lifts above the keyboard.
 */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { medium, height } = useBreakpoint();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={medium ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, medium ? styles.centre : styles.bottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" accessibilityRole="button" />
        <View
          style={[styles.sheet, medium ? styles.dialog : styles.phoneSheet, { maxHeight: height * (medium ? 0.88 : 0.92), paddingBottom: medium ? 22 : insets.bottom + 18 }]}
          accessibilityViewIsModal
          accessibilityLabel={title}
        >
          {!medium ? <View style={styles.handle} /> : null}
          <View style={styles.head}>
            <AppText variant="h2" style={styles.title} accessibilityRole="header">{title}</AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close} hitSlop={6}>
              <Icon name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** APK `confirmAction`: text plus Cancel / Confirm. */
export function ConfirmDialog({ visible, title, text, confirmLabel = 'Confirm', onCancel, onConfirm, busy }: {
  visible: boolean; title: string; text: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void; busy?: boolean;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onCancel}>
      <AppText variant="small" style={{ marginBottom: 18 }}>{text}</AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={confirmLabel} onPress={onConfirm} loading={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  bottom: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: 14 },
  phoneSheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, marginHorizontal: 10 },
  dialog: { width: '100%', maxWidth: 560, borderRadius: radius.sheet, paddingTop: 22 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#D9DFE9', alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  title: { flex: 1 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F7FB', borderWidth: 1, borderColor: '#EDF0F5', alignItems: 'center', justifyContent: 'center' },
  body: { paddingBottom: 6 },
});
export { Sheet as AppModal };
