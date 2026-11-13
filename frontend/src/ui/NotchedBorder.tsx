import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Splits the top edge of a bordered field so a floating label sits in a real gap in the border
 * rather than on a painted rectangle that would show as a patch on non-white surfaces. The field
 * itself must set borderTopColor: 'transparent'.
 */
export function NotchedBorder({ color, radius, labelWidth, width = 1 }: { color: string; radius: number; labelWidth: number; width?: number }) {
  const start = Math.max(8, radius + 1);
  const end = start + Math.ceil(labelWidth) + 6;
  return <>
    <View pointerEvents="none" accessible={false} style={[s.left, { width: start, height: radius + 2, borderTopLeftRadius: radius, borderColor: color, borderTopWidth: width, borderLeftWidth: width }]} />
    <View pointerEvents="none" accessible={false} style={[s.right, { left: end, height: radius + 2, borderTopRightRadius: radius, borderColor: color, borderTopWidth: width, borderRightWidth: width }]} />
  </>;
}

const s = StyleSheet.create({
  left: { position: 'absolute', top: -1, left: -1 },
  right: { position: 'absolute', top: -1, right: -1 },
});
