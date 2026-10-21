import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppIcon, type AppIconName } from './AppIcon';
import { colors } from '../shared/theme/colors';
import { RESPONSIVE_BREAKPOINTS } from './responsiveBreakpoints';

export type SummaryMetric = {
  id: string;
  label: string;
  value: number | string;
  icon: AppIconName;
  caption?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'purple';
  onPress?: () => void;
  selected?: boolean;
};

const tones = {
  neutral: { color: colors.primary, backgroundColor: colors.primaryLight },
  success: { color: colors.success, backgroundColor: '#e6f5ee' },
  warning: { color: colors.warning, backgroundColor: '#fff3dc' },
  danger: { color: colors.danger, backgroundColor: '#fcecf0' },
  purple: { color: '#7853c8', backgroundColor: '#eee7ff' },
};

/** Counts share a layout while each page owns its scope and filtering behavior. */
export function SummaryMetrics({ title, caption, items, loading = false, unavailable = false, testID, compact = false, dense = false, variant = 'panel' }: {
  title?: string;
  caption?: string;
  items: SummaryMetric[];
  loading?: boolean;
  unavailable?: boolean;
  testID?: string;
  compact?: boolean;
  dense?: boolean;
  variant?: 'panel' | 'plain';
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const available = Math.max(0, (width || window.width - 64) - (variant === 'plain' ? 0 : 26));
  const mobile = window.width < RESPONSIVE_BREAKPOINTS.mobile;
  const compactLayout = compact && !mobile;
  const mobileColumns = compact ? 3 : 2;
  const denseMobile = dense && mobile;
  const columns = mobile ? 2 : compactLayout ? 3 : available < 620 ? 2 : available < 1050 ? 3 : 4;
  const metricWidth = Math.max(0, (available - (columns - 1) * 8) / columns);
  const cardWidth: number | `${number}%` = compactLayout ? '31%' : metricWidth;
  const measure = (event: { nativeEvent?: { layout?: { width?: number } | null } }) => {
    const measuredWidth = event.nativeEvent?.layout?.width;
    if (typeof measuredWidth !== 'number' || !Number.isFinite(measuredWidth)) return;
    setWidth(current => Math.abs(current - measuredWidth) > 1 ? measuredWidth : current);
  };
  const renderMetric = (item: SummaryMetric) => {
    const tone = tones[item.tone ?? 'neutral'];
    const value = loading || unavailable ? '—' : typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value;
    const disabled = loading || unavailable;
    const content = <>
      {!denseMobile && <View style={[s.icon, compact && s.iconCompact, { backgroundColor: tone.backgroundColor }]}><AppIcon name={item.icon} color={tone.color} size={compact ? 14 : 16} /></View>}
      <View style={s.labelGroup}><Text numberOfLines={2} style={[s.label, compact && s.labelCompact, denseMobile && s.labelDense]}>{item.label}</Text></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.value, compact && s.valueCompact, denseMobile && s.valueDense]}>{value}</Text>
      {!!item.caption && <Text style={s.itemCaption}>{item.caption}</Text>}
      {!!item.onPress && <View style={s.affordance}><AppIcon name={item.selected ? 'check-circle' : 'arrow-up-right'} size={13} color={item.selected ? tone.color : '#6a7d90'} /></View>}
    </>;
    const cardStyle = [s.metric, compact && s.metricCompact, denseMobile && s.metricDense, mobile ? s.mobileCell : { width: cardWidth, flexGrow: 0, flexShrink: 0 }, item.selected && { borderColor: tone.color, backgroundColor: '#f5faf9' }];
    return item.onPress ? <Pressable key={item.id} testID={testID ? `${testID}-${item.id}` : undefined} accessibilityRole="button" accessibilityLabel={`${item.label}: ${value}`} accessibilityHint={`Filter by ${item.label.toLowerCase()}`} aria-pressed={!!item.selected} accessibilityState={{ selected: !!item.selected, disabled, busy: loading }} disabled={disabled} onPress={item.onPress} style={({ pressed }) => [...cardStyle, pressed && s.pressed]}>{content}</Pressable>
      : <View key={item.id} accessible accessibilityLabel={`${item.label}: ${value}`} accessibilityState={{ busy: loading }} style={cardStyle}>{content}</View>;
  };
  return <View testID={testID} onLayout={measure} style={[s.banner, variant === 'plain' && s.plain]}>
    {(title || caption || loading || unavailable) && <View style={s.heading}>
      {!!title && <Text accessibilityRole="header" style={s.title}>{title}</Text>}
      {(caption || loading || unavailable) && <Text style={s.caption}>{loading ? 'Loading summary…' : unavailable ? 'Summary unavailable' : caption}</Text>}
    </View>}
    {mobile ? <View style={s.mobileMetrics}>
      {items.filter((_, index) => index % mobileColumns === 0).map((item, row) => (
        <View key={item.id} style={[s.mobileRow, compact && s.mobileRowCompact]}>
          {items.slice(row * mobileColumns, (row + 1) * mobileColumns).map(renderMetric)}
          {Array.from({ length: Math.max(0, mobileColumns - (items.length - row * mobileColumns)) }, (_, index) => <View key={`empty-${index}`} style={s.mobileCell} />)}
        </View>
      ))}
    </View> : <View style={[s.metrics, compactLayout && s.metricsCompact]}>
      {items.map(renderMetric)}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  banner: { width: '100%', minWidth: 0, padding: 12, gap: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  plain: { padding: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  heading: { gap: 3 }, title: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 },
  mobileMetrics: { width: '100%', gap: 8 },
  mobileRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  mobileRowCompact: { gap: 4 },
  mobileCell: { flex: 1, minWidth: 0 },
  metricsCompact: { flexWrap: 'nowrap', justifyContent: 'space-between', gap: 4 },
  metric: { position: 'relative', minWidth: 0, minHeight: 94, padding: 12, gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: '#F3F6FC' },
  metricCompact: { minHeight: 78, padding: 7, gap: 4, borderRadius: 9 },
  metricDense: { minHeight: 78, padding: 8, gap: 4, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconCompact: { width: 22, height: 22, borderRadius: 6 },
  labelGroup: { flex: 1, minWidth: 0 }, rowLabel: { justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 18, color: '#405573', fontWeight: '500' },
  labelCompact: { fontSize: 9, lineHeight: 12 },
  labelDense: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  value: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  valueCompact: { fontSize: 18, lineHeight: 22 },
  valueDense: { fontSize: 15, lineHeight: 18, textAlign: 'center' },
  itemCaption: { color: '#71829c', fontSize: 11, lineHeight: 16 },
  affordance: { position: 'absolute', top: 12, right: 10 }, pressed: { opacity: 0.75 },
});
