/**
 * Composite blocks reproduced from the APK v2.3 "studio" dashboard styles
 * (workspace.css: .flow-stat, .studio-module, .flow-tile, .studio-quick, .usage-card).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, tones, type Tone } from '../../theme/tokens';
import { USAGE_KEYS, type Limits, type Usage } from '../../core/domain/subscription';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Icon, type IconName } from './Icon';

export function StatCard({ label, value, hint, icon, tone, onPress }: { label: string; value: string; hint: string; icon: IconName; tone: Tone; onPress?: () => void }) {
  const t = tones[tone];
  const { sidebar } = useBreakpoint();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label + ': ' + value + '. ' + hint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: t.tint, borderColor: t.border, padding: sidebar ? 21 : 15 }, pressed ? styles.pressed : null]}
    >
      <View style={styles.between}>
        <View style={[styles.statIcon, { backgroundColor: t.iconBg }]}><Icon name={icon} size={15} color={t.iconFg} /></View>
        {onPress ? <Icon name="chevron" size={15} color={colors.faint} /> : null}
      </View>
      <Text style={[styles.statLabel, { fontSize: sidebar ? 12 : 11 }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { fontSize: sidebar ? 27 : 23 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statHint} numberOfLines={2}>{hint}</Text>
    </Pressable>
  );
}

export function ModuleCard({ label, description, icon, tone, count, onPress, footer = 'Open workspace' }: {
  label: string; description: string; icon: IconName; tone: Tone; count?: string; onPress: () => void; footer?: string;
}) {
  const t = tones[tone];
  const { sidebar } = useBreakpoint();
  const pad = sidebar ? 18 : 15;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label + '. ' + description} onPress={onPress} style={({ pressed }) => [styles.module, { paddingHorizontal: pad, paddingTop: pad + 1 }, pressed ? styles.pressed : null]}>
      <View style={styles.between}>
        <View style={[styles.tileIcon, { backgroundColor: t.iconBg }]}><Icon name={icon} size={19} color={t.iconFg} /></View>
        {count ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      <Text style={[styles.moduleTitle, { fontSize: sidebar ? 17 : 16 }]}>{label}</Text>
      <Text style={styles.moduleText}>{description}</Text>
      <View style={[styles.moduleFoot, { marginHorizontal: -pad, paddingHorizontal: pad }]}>
        <Text style={[styles.footText, { color: t.link }]}>{footer}</Text>
        <Icon name="chevron" size={14} color={t.link} />
      </View>
    </Pressable>
  );
}

export function Tile({ title, description, icon, tone, onPress }: { title: string; description: string; icon: IconName; tone: Tone; onPress: () => void }) {
  const t = tones[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title + '. ' + description} onPress={onPress} style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}>
      <View style={[styles.tileIcon, { backgroundColor: t.iconBg }]}><Icon name={icon} size={19} color={t.iconFg} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.tileTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.tileText} numberOfLines={2}>{description}</Text>
      </View>
      <Icon name="chevron" size={16} color={colors.faint} />
    </Pressable>
  );
}

export function QuickAction({ label, icon, tone, onPress }: { label: string; icon: IconName; tone: Tone; onPress: () => void }) {
  const t = tones[tone];
  const { sidebar } = useBreakpoint();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quick, sidebar ? styles.quickRow : null, pressed ? { opacity: 0.75 } : null]}>
      <View style={[styles.quickIcon, { backgroundColor: t.iconBg }]}><Icon name={icon} size={18} color={t.iconFg} /></View>
      <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const usageLabel: Record<keyof Usage, string> = { employees: 'Employees', branches: 'Branches', companies: 'Companies', users: 'Users' };

/** APK `.usage-grid`: used / allowed with a coverage bar. */
export function UsageCard({ name, used, limit }: { name: keyof Usage; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <View style={styles.usage} accessibilityLabel={usageLabel[name] + ': ' + used + ' of ' + limit}>
      <View style={styles.between}>
        <Text style={styles.usageName}>{usageLabel[name]}</Text>
        <Text style={[styles.usageValue, used > limit ? { color: colors.error } : null]}>{used} / {limit}</Text>
      </View>
      <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%` }, used > limit ? { backgroundColor: colors.error } : null]} /></View>
    </View>
  );
}
export const usageKeys = USAGE_KEYS;
export type { Limits, Usage };

/** APK `.money-row` and `.money-row.total`. */
export function MoneyRow({ label, value, total }: { label: string; value: React.ReactNode; total?: boolean }) {
  return (
    <View style={[styles.money, total ? styles.moneyTotal : null]}>
      <Text style={[styles.moneyLabel, total ? styles.totalText : null]}>{label}</Text>
      {typeof value === 'string' ? <Text style={[styles.moneyValue, total ? styles.totalText : null]}>{value}</Text> : value}
    </View>
  );
}

/** Label/value rows for record details. */
export function DetailList({ rows }: { rows: [string, string][] }) {
  return (
    <View>
      {rows.map(([k, v]) => (
        <View key={k} style={styles.detailRow}>
          <Text style={styles.detailKey}>{k}</Text>
          <Text style={styles.detailValue} selectable>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  stat: { borderRadius: 18, borderWidth: 1, minHeight: 138, ...shadow },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statLabel: { color: '#5C6E84', fontWeight: '600' },
  statValue: { color: colors.inkStrong, fontWeight: '700', letterSpacing: -0.8, marginTop: 4, marginBottom: 5 },
  statHint: { color: '#64778C', fontSize: 11, lineHeight: 15 },
  module: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', flex: 1, ...shadow },
  tileIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 9, fontWeight: '600', color: '#7B889B' },
  moduleTitle: { color: colors.heading, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  moduleText: { fontSize: 12, lineHeight: 18, color: '#687990', marginBottom: 13, minHeight: 36 },
  moduleFoot: { marginTop: 'auto', paddingVertical: 12, backgroundColor: colors.surfaceRaised, borderTopWidth: 1, borderTopColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footText: { fontSize: 11, fontWeight: '700' },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.tile, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 16, marginBottom: 10, ...shadow },
  tileTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  tileText: { fontSize: 11, lineHeight: 16, color: '#697A90', marginTop: 3 },
  quick: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 4, minHeight: 44 },
  quickRow: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 10 },
  quickIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: colors.ink },
  usage: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E3E9F2', borderRadius: radius.tile, padding: 17 },
  usageName: { fontSize: 12, fontWeight: '700', color: colors.ink },
  usageValue: { fontSize: 12, color: colors.ink },
  bar: { height: 5, borderRadius: 8, backgroundColor: '#EEF1F5', marginTop: 15, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 8, backgroundColor: colors.primary },
  money: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 10 },
  moneyLabel: { fontSize: 13, color: colors.ink, flex: 1 },
  moneyValue: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  moneyTotal: { backgroundColor: '#EFF6F4', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 18, marginTop: 14, marginHorizontal: -6 },
  totalText: { color: '#195E50', fontSize: 17, fontWeight: '800' },
  detailRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0F3F8', gap: 12 },
  detailKey: { width: 110, fontSize: 12, color: colors.subtle },
  detailValue: { flex: 1, fontSize: 13, color: colors.ink },
});
