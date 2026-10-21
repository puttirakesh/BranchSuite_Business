import React, { useEffect, useId, useSyncExternalStore } from 'react';
import { Modal, type ModalProps, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { toastStore } from './toast-store';

const palette = {
  success: { color: '#166534', icon: 'check-circle' as const, label: 'Success' },
  error: { color: '#B42318', icon: 'alert-circle' as const, label: 'Error' },
  info: { color: '#2457C5', icon: 'info' as const, label: 'Information' },
};

function ToastViewport({ host = 'root' }: { host?: string }) {
  const { toast, host: activeHost } = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!toast || host !== activeHost) return null;
  const theme = palette[toast.kind];
  return <View pointerEvents="box-none" style={[styles.viewport, {
    top: insets.top + 12,
    left: insets.left + 12,
    right: insets.right + 12,
    alignItems: width >= 1024 ? 'flex-end' : 'center',
  }]}>
    <View key={toast.id} testID="app-toast" accessibilityRole="alert" accessibilityLiveRegion={toast.kind === 'error' ? 'assertive' : 'polite'}
      style={[styles.toast, { borderLeftColor: theme.color }]}>
      <AppIcon name={theme.icon} size={22} color={theme.color} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.color }]}>{theme.label}</Text>
        <Text style={styles.message}>{toast.message}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => toastStore.dismiss(toast.id)} style={styles.close}>
        <AppIcon name="x" size={20} color="#53647A" />
      </Pressable>
    </View>
  </View>;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <View style={styles.root}>{children}<ToastViewport /></View>;
}

// Native modals have their own window. Render feedback in the topmost open
// modal as well, so errors remain visible and dismissible on Android and iOS.
export function ToastModal({ children, visible = true, ...props }: ModalProps) {
  const id = useId();
  useEffect(() => visible ? toastStore.registerHost(id) : undefined, [id, visible]);
  return <Modal {...props} visible={visible}>{children}<ToastViewport host={id} /></Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewport: { position: 'absolute', zIndex: 10000, elevation: 10000 },
  toast: { width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingRight: 4,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5EF', borderLeftWidth: 4, borderRadius: 12,
    shadowColor: '#14233B', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  content: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  message: { color: '#20334F', fontSize: 13, lineHeight: 19, flexShrink: 1 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
