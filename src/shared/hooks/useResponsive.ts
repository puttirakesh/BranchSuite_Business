import { useWindowDimensions } from 'react-native';
export function useResponsive() { const { width, height } = useWindowDimensions(); return { width, height, isMobile: width < 600, isTablet: width >= 600 && width < 1000, isDesktop: width >= 1000, columns: width < 360 ? 1 : width < 1000 ? 2 : 4 }; }
