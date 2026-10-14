import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useAdminViewport() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const desktop = Platform.OS === 'web' && window.width >= 900;
  const sidebarWidth = window.width >= 1200 ? 224 : 208;
  return {
    ...window,
    desktop,
    keyboardVisible,
    insets,
    sidebarWidth,
    width: Math.max(0, window.width - insets.left - insets.right - (desktop ? sidebarWidth : 0)),
    height: Math.max(0, window.height - insets.top - insets.bottom - (desktop ? 72 : 0)),
  };
}
