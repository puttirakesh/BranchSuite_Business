import { Pressable, ScrollView, Text, View, type ViewProps } from 'react-native';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { colors } from '../../ui/theme';
export default function AppCard(props: ViewProps) { return <View {...props} style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20, gap: 8 }, props.style]} />; }

export function AdminPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 16 }} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 6 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>BRANCHSUITE PLATFORM</Text><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{title}</Text>{subtitle && <Text style={{ color: colors.muted, lineHeight: 21 }}>{subtitle}</Text>}</View>
    {children}
  </ScrollView>;
}
export function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={label + ': ' + option} accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: value === option ? colors.primary : colors.surface }}><Text style={{ color: value === option ? colors.surface : colors.text }}>{option}</Text></Pressable>)}</View></View>;
}
export function RecordLink({ title, href }: { title: string; href: string }) {
  return <Pressable accessibilityRole="link" onPress={() => router.push(href as Href)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{title}</Text></Pressable>;
}
