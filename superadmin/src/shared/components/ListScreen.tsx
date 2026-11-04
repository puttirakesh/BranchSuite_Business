import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { colors } from '../../theme/tokens';
import { env } from '../../core/config/env';
import { useBreakpoint, useColumns } from '../hooks/useBreakpoint';
import { ErrorState } from './ErrorState';
import { LoadingList } from './LoadingState';

/**
 * Virtualised list page. Same gutters and footer as <Screen>, but rows are rendered by
 * FlatList so long customer, invoice, ticket or audit lists stay fast.
 */
export function ListScreen<T>({ header, data, isPending, error, refetch, renderItem, keyOf, columns = { base: 1 }, empty, footer, gap = 10 }: {
  header: React.ReactElement;
  data: T[] | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
  renderItem: (item: T) => React.ReactElement;
  keyOf: (item: T) => string;
  columns?: { base: number; medium?: number; sidebar?: number; wide?: number };
  empty: React.ReactElement;
  footer?: React.ReactElement | null;
  gap?: number;
}) {
  const { sidebar, medium } = useBreakpoint();
  const count = useColumns(columns);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Pad the last row so cards keep equal widths in multi-column layouts.
  const rows: (T | null)[] = data ? [...data] : [];
  while (count > 1 && rows.length % count) rows.push(null);

  const render: ListRenderItem<T | null> = ({ item }) => (
    <View style={{ flex: 1, minWidth: 0 }}>{item ? renderItem(item) : null}</View>
  );

  const body = isPending ? <LoadingList /> : error ? <ErrorState error={error} onRetry={() => void refetch()} /> : data && !data.length ? empty : null;

  return (
    <FlatList
      key={'cols-' + count}
      style={styles.list}
      data={isPending || error ? [] : rows}
      numColumns={count}
      renderItem={render}
      keyExtractor={(item, index) => (item ? keyOf(item) : 'pad-' + index)}
      columnWrapperStyle={count > 1 ? { gap } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      ListHeaderComponent={<View>{header}{body}</View>}
      ListFooterComponent={
        <View>
          {footer}
          <Text style={styles.footer}>
            {env.appName} · {env.dataMode === 'preview' ? 'preview sample data, not for production' : env.dataMode === 'api' ? 'connected to shared backend' : 'no backend connected'}
          </Text>
        </View>
      }
      contentContainerStyle={[styles.content, { paddingHorizontal: sidebar ? 32 : medium ? 24 : 18, paddingTop: sidebar ? 32 : 22 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40, width: '100%', maxWidth: 1304, alignSelf: 'center' },
  footer: { fontSize: 10, color: '#7E8B9C', textAlign: 'center', marginTop: 32 },
});
