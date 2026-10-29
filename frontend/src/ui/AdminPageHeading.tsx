import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { AppIcon } from './AppIcon';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';
import { RESPONSIVE_BREAKPOINTS } from './responsiveBreakpoints';

export function useWebSectionHeader() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= RESPONSIVE_BREAKPOINTS.tablet;
}

export function AdminPageHeading({
  title,
  onBack,
  showBack = true,
  backDisabled = false,
  titleStyle,
  style,
  children,
  branch,
  branchControl,
  onRefresh,
  refreshing = false,
  refreshDisabled = false,
}: {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  backDisabled?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  branch?: { value: string; onPress: () => void; label?: string; disabled?: boolean };
  branchControl?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshDisabled?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const webHeader = Platform.OS === 'web' && width >= RESPONSIVE_BREAKPOINTS.tablet;
  const compactWebHeader = webHeader && width < RESPONSIVE_BREAKPOINTS.desktop;
  const sectionGap = width >= RESPONSIVE_BREAKPOINTS.desktop ? 12 : width >= RESPONSIVE_BREAKPOINTS.tablet ? 10 : 8;
  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (pathname === '/admin/more') router.replace('/admin/dashboard');
    else if (pathname.startsWith('/admin')) router.replace('/admin/more');
    else if (pathname === '/employee/dashboard') router.replace('/employee/profile');
    else if (pathname.startsWith('/employee')) router.replace('/employee/dashboard');
    else if (pathname.startsWith('/auth')) router.replace('/auth/login');
    else router.replace('/');
  };
  return (
    <View testID="section-header" style={[styles.spacing, webHeader && styles.webSpacing, style, { marginBottom: sectionGap }, styles.row, compactWebHeader && styles.compactWebRow]}>
      {showBack && <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Go back from ${title}`}
        disabled={backDisabled}
        onPress={goBack}
        style={styles.back}
      >
        <AppIcon name="arrow-left" size={16} color="#000" />
      </Pressable>}
      <View style={styles.text}>
        <Text accessibilityRole="header" numberOfLines={webHeader ? 1 : undefined} style={[styles.title, titleStyle, webHeader && styles.webTitle]}>
          {title}
        </Text>
      </View>
      {(children || webHeader && (branch || branchControl || onRefresh)) ? <View style={[styles.action, webHeader && styles.webActions, compactWebHeader && styles.compactWebActions]}>
        {webHeader && (branchControl || (branch && <Pressable accessibilityRole="button" accessibilityLabel={branch.label ?? 'Choose branch'} accessibilityValue={{ text: branch.value || 'Select a branch' }} disabled={branch.disabled} onPress={branch.onPress} style={[styles.branch, branch.disabled && styles.disabled]}>
          <View style={styles.branchText}><Text numberOfLines={1} style={[styles.branchValue, !branch.value && styles.branchPlaceholder]}>{branch.value || 'Select a branch'}</Text></View><AppIcon name="chevron-down" size={16} color="#607591" />
        </Pressable>))}
        {children}
        {webHeader && onRefresh && <Pressable accessibilityRole="button" accessibilityLabel={`Refresh ${title.toLowerCase()}`} accessibilityState={{ disabled: refreshing || refreshDisabled, busy: refreshing }} disabled={refreshing || refreshDisabled} onPress={onRefresh} style={[styles.refresh, (refreshing || refreshDisabled) && styles.disabled]}><AppIcon name="refresh-cw" size={17} color={web ? webWorkspaceTheme.primary : '#345cf2'} /><Text style={styles.refreshText}>Refresh</Text></Pressable>}
      </View> : null}
    </View>
  );
}

const web = Platform.OS === 'web';
const styles = webWorkspaceStyles(StyleSheet.create({
  spacing: { marginBottom: 12 }, webSpacing: { marginBottom: 16 },
  row: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  compactWebRow: { flexWrap: 'wrap' },
  back: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, flexShrink: 1, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#20334f' },
  webTitle: { marginTop: 0, marginBottom: 0, paddingVertical: 0, fontSize: 24, lineHeight: 32, color: '#17243B', letterSpacing: -0.5 },
  action: { minWidth: 0, maxWidth: '55%', flexShrink: 1, justifyContent: 'center', alignItems: 'flex-end' },
  webActions: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-end', gap: 10, maxWidth: '78%', flexShrink: 0 },
  compactWebActions: { width: '100%', maxWidth: '100%', flexBasis: '100%', flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  branch: { width: 180, minHeight: 54, paddingHorizontal: 12, paddingVertical: 5, borderRadius: web ? webWorkspaceTheme.radiusControl : 8, borderWidth: 1, borderColor: '#d7e0ea', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8 },
  branchText: { flex: 1, minWidth: 0 }, branchValue: { fontSize: 13, lineHeight: 18, color: '#20334f', fontWeight: '500' }, branchPlaceholder: { color: '#607591', fontWeight: '400' },
  refresh: { minWidth: 44, height: 44, paddingHorizontal: 12, borderRadius: web ? webWorkspaceTheme.radiusControl : 8, borderWidth: 1, borderColor: '#d7e0ea', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  refreshText: { fontSize: 13, fontWeight: '600', color: web ? webWorkspaceTheme.primary : '#345cf2' },
  disabled: { opacity: 0.5 },
}));
