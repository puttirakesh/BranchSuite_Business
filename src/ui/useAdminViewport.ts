import { Platform, useWindowDimensions } from 'react-native';

export function useAdminViewport() {
  const window = useWindowDimensions();
  const desktop = Platform.OS === 'web' && window.width >= 900;
  const sidebarWidth = window.width >= 1200 ? 224 : 208;
  return {
    ...window,
    desktop,
    sidebarWidth,
    width: desktop ? window.width - sidebarWidth : window.width,
    height: desktop ? Math.max(0, window.height - 72) : window.height,
  };
}
