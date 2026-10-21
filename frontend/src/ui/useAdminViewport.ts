import { useEffect, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { webWorkspaceLayout } from './workspace-navigation';
import { RESPONSIVE_BREAKPOINTS, screenClass } from './responsiveBreakpoints';

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
  const rawLayout = screenClass(window.width);
  const layout = Platform.OS === 'web' ? rawLayout : rawLayout === 'mobile' ? 'mobile' : 'tablet';
  const desktop = layout === 'desktop';
  const navigation = webWorkspaceLayout(Platform.OS === 'web' ? window.width : 0);
  const { sidebarWidth } = navigation;
  return {
    ...window,
    desktop,
    mobile: layout === 'mobile',
    tablet: layout === 'tablet',
    layout,
    ...navigation,
    keyboardVisible,
    insets,
    width: Math.max(0, window.width - insets.left - insets.right - sidebarWidth),
    height: Math.max(0, window.height - insets.top - insets.bottom - (desktop ? 72 : 0)),
  };
}
