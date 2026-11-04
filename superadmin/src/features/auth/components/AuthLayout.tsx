import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow } from '../../../theme/tokens';
import { Icon } from '../../../shared/components';
import { useBreakpoint } from '../../../shared/hooks/useBreakpoint';

/** APK public header + `.flow-auth` layout: story panel on wide screens, form card always. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { sidebar } = useBreakpoint();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.mark}><Text style={styles.markText}>A</Text></View>
            <View>
              <Text style={styles.brandName}>BranchSuite</Text>
              <Text style={styles.brandSub}>ADMIN PANEL</Text>
            </View>
          </View>
          <Text style={styles.access}>Admin access</Text>
        </View>
        <View style={[styles.layout, sidebar ? styles.layoutWide : null]}>
          {sidebar ? (
            <View style={styles.story}>
              <Text style={styles.storyEyebrow}>THE ADMIN WORKSPACE</Text>
              <Text style={styles.storyTitle}>A clear view.{'\n'}A better-run platform.</Text>
              <Text style={styles.storyText}>Manage customers, subscriptions and support with a clear next action.</Text>
              <View style={styles.visual}>
                <Text style={styles.visualTop}>Platform workspace</Text>
                <View style={styles.visualGrid}>
                  <View style={styles.visualCell}><Icon name="building" color={colors.primary} /><Text style={styles.cellTitle}>Customers</Text><Text style={styles.cellSub}>Plans & renewals</Text></View>
                  <View style={styles.visualCell}><Icon name="support" color={colors.primary} /><Text style={styles.cellTitle}>Support</Text><Text style={styles.cellSub}>Every request</Text></View>
                </View>
              </View>
            </View>
          ) : null}
          <View style={[styles.card, sidebar ? { width: 440 } : null]}>{children}</View>
        </View>
        <Text style={styles.footer}>Admin panel · BranchSuite</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1100, width: '100%', alignSelf: 'center', marginBottom: 26 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  brandName: { fontSize: 15, fontWeight: '800', color: colors.ink },
  brandSub: { fontSize: 8, fontWeight: '800', color: '#73819A', letterSpacing: 1.2 },
  access: { fontSize: 11, fontWeight: '700', color: colors.primary },
  layout: { width: '100%', maxWidth: 1100, alignSelf: 'center', alignItems: 'center' },
  layoutWide: { flexDirection: 'row', alignItems: 'stretch', gap: 28, justifyContent: 'center' },
  story: { flex: 1, maxWidth: 560, backgroundColor: '#F1ECFC', borderRadius: 28, padding: 40, justifyContent: 'center' },
  storyEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#7C64B8' },
  storyTitle: { fontSize: 36, fontWeight: '800', color: colors.ink, letterSpacing: -1.1, lineHeight: 42, marginTop: 14 },
  storyText: { fontSize: 14, color: colors.muted, marginTop: 14, lineHeight: 21 },
  visual: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginTop: 30, ...shadow },
  visualTop: { fontSize: 11, fontWeight: '700', color: colors.subtle, marginBottom: 12 },
  visualGrid: { flexDirection: 'row', gap: 12 },
  visualCell: { flex: 1, backgroundColor: '#F8F6FF', borderRadius: 14, padding: 14, gap: 4 },
  cellTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 6 },
  cellSub: { fontSize: 11, color: colors.subtle },
  card: { width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderRadius: 28, borderWidth: 1, borderColor: colors.line, padding: 24, ...shadow },
  footer: { fontSize: 10, color: '#7E8B9C', textAlign: 'center', marginTop: 28 },
  r: { borderRadius: radius.card },
});
