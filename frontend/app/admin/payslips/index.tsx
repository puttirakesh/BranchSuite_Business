import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PayslipsScreen from '../../employee/payslips';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { webWorkspaceStyles } from '../../../src/ui/webWorkspaceStyles';

export default function MyPayslipsPage() {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 12 : width < 768 ? 16 : 20;
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}><View style={styles.body}><PayslipsScreen /></View></ScrollView>
    <AdminBottomNavigation />
  </SafeAreaView>;
}
const styles = webWorkspaceStyles(StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f6f8fd' }, content: { padding: 20, paddingBottom: 36 },
  body: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
}));
