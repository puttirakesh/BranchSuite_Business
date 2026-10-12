import React from 'react';
import { StyleSheet, View } from 'react-native';

// Native navigation is provided by Expo Router and AdminBottomNavigation.
export function AdminWebShell({ children }: { children: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, minWidth: 0, minHeight: 0 } });
