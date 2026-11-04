import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../theme/tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useBreakpoint } from '../hooks/useBreakpoint';

/**
 * APK `.page-head`: eyebrow, title, subtitle, optional action on the right.
 * `back` adds the APK `.flow-back` link used on detail screens.
 */
export function PageHeader({ title, subtitle, action, back, eyebrow = 'BranchSuite platform', level = 1 }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  back?: string;
  eyebrow?: string | null;
  level?: 1 | 2;
}) {
  const { medium } = useBreakpoint();
  return (
    <View style={[styles.head, level === 2 ? styles.sectionHead : null]}>
      <View style={styles.text}>
        {back ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(back as never))}
            style={styles.back}
            hitSlop={8}
          >
            <Icon name="back" size={15} color={colors.primary} />
            <AppText variant="label" color={colors.primary}>Back</AppText>
          </Pressable>
        ) : null}
        {eyebrow ? <AppText variant="eyebrow" style={styles.eyebrow}>{eyebrow}</AppText> : null}
        <AppText variant={level === 1 ? 'h1' : 'h2'} style={level === 1 && !medium ? styles.phoneTitle : null} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText variant="body" color={colors.muted} style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** APK `.section-title`: h2 plus an optional text link on the right. */
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h2" accessibilityRole="header">{title}</AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 },
  sectionHead: { marginTop: 10, marginBottom: 16 },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { marginBottom: 8 },
  phoneTitle: { fontSize: 27, lineHeight: 32 },
  subtitle: { marginTop: 6 },
  action: { flexShrink: 0 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, alignSelf: 'flex-start', minHeight: 32 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 14, gap: 12 },
});
