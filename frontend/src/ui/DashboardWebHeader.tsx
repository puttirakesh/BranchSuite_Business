import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { DashboardDateTimeCard } from './DashboardDateTimeCard';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

/** Reflow against the actual space remaining after the sidebar and gutters. */
export function DashboardWebHeader({ greeting, branch, onRefresh, refreshing = false }: {
  greeting: string; branch?: React.ReactNode; onRefresh?: () => void; refreshing?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const wide = width >= 680;
  const narrow = width > 0 && width < 340;
  const simple = !branch && !onRefresh;
  return <View testID="section-header" onLayout={event => setWidth(current => Math.abs(current - event.nativeEvent.layout.width) > 1 ? event.nativeEvent.layout.width : current)} style={[s.header, wide && s.wide, simple && s.simpleHeader]}>
    <Text testID="dashboard-greeting" accessibilityRole="header" style={[s.greeting, wide && s.wideGreeting, narrow && s.narrowGreeting, simple && s.simpleGreeting, simple && narrow && s.smallGreeting]}>{greeting}</Text>
    <View style={[s.controls, wide && s.wideControls, narrow && s.narrowControls, simple && s.simpleControls]}>
      <DashboardDateTimeCard compact />
      {!!branch && !narrow && <View style={[s.branch, wide && s.wideBranch]}>{branch}</View>}
      {!!onRefresh && <Pressable accessibilityRole="button" accessibilityLabel="Refresh dashboard" accessibilityState={{ disabled: refreshing, busy: refreshing }} disabled={refreshing} onPress={onRefresh} style={[s.refresh, refreshing && s.disabled]}><AppIcon name="refresh-cw" size={18} color={webWorkspaceTheme.primary} />{wide && <Text style={s.refreshText}>Refresh</Text>}</Pressable>}
    </View>
    {!!branch && narrow && <View style={s.fullBranch}>{branch}</View>}
  </View>;
}

const s = webWorkspaceStyles(StyleSheet.create({
  header: { width: '100%', minWidth: 0, gap: 14, marginBottom: 16 },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  greeting: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6, color: webWorkspaceTheme.text, minWidth: 0 },
  wideGreeting: { flex: 1, fontSize: 28, lineHeight: 36 },
  narrowGreeting: { fontSize: 22, lineHeight: 30 },
  narrowControls: { justifyContent: 'space-between' },
  fullBranch: { width: '100%', minWidth: 0 },
  simpleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  simpleGreeting: { flex: 1 },
  smallGreeting: { fontSize: 18, lineHeight: 26 },
  simpleControls: { width: 'auto', flexShrink: 0 },
  controls: { width: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  wideControls: { width: 'auto', flexShrink: 0, gap: 12 },
  branch: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  wideBranch: { flexGrow: 0, flexShrink: 0, flexBasis: 180, width: 180 },
  refresh: { minWidth: 44, height: 44, paddingHorizontal: 12, flexShrink: 0, borderRadius: webWorkspaceTheme.radiusControl, borderWidth: 1, borderColor: webWorkspaceTheme.border, backgroundColor: webWorkspaceTheme.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  refreshText: { fontSize: 13, fontWeight: '600', color: webWorkspaceTheme.primary },
  disabled: { opacity: 0.5 },
}));
