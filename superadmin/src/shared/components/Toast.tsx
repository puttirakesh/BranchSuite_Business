import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

const ToastContext = createContext<(message: string) => void>(() => {});

/** APK `#toast`: dark pill, announced to screen readers, hides after 3.2 s. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((text: string) => {
    setMessage(text);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMessage(null));
    }, 3200);
  }, [opacity]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, bottom: insets.bottom + 92 }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: 420, marginHorizontal: 20, backgroundColor: colors.toast, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, elevation: 6 },
  text: { color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
});
