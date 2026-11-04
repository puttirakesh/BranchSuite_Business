import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useColumns } from '../hooks/useBreakpoint';

/**
 * Responsive card grid (React Native has no CSS grid). Children are chunked into rows of
 * equal flex cells, so widths never depend on measuring and cannot wrap because of
 * sub-pixel rounding. The last row is padded so cells keep equal widths.
 */
export function Grid({ children, columns, gap = 14, style }: {
  children: React.ReactNode;
  columns: { base: number; medium?: number; sidebar?: number; wide?: number };
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const count = useColumns(columns);
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += count) rows.push(items.slice(i, i + count));
  return (
    <View style={[{ gap, width: '100%' }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>
          {Array.from({ length: count }, (_, c) => (
            <View key={c} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
              {row[c] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
