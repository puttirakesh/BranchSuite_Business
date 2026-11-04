import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { env } from '../../core/config/env';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function Screen({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => Promise<unknown> }) {
  const { sidebar, medium } = useBreakpoint();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingHorizontal: sidebar ? 32 : medium ? 24 : 18, paddingTop: sidebar ? 32 : 22 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} /> : undefined}
    >
      <View style={styles.inner}>{children}</View>
      <Text style={styles.footer}>
        {env.appName} · {env.dataMode === 'preview' ? 'preview sample data, not for production' : env.dataMode === 'api' ? 'connected to shared backend' : 'no backend connected'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40, flexGrow: 1 },
  inner: { width: '100%', maxWidth: 1240, alignSelf: 'center' },
  footer: { fontSize: 10, color: '#7E8B9C', textAlign: 'center', marginTop: 32 },
});
