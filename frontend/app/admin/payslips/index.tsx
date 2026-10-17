import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PayslipsScreen from '../../employee/payslips';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';

export default function MyPayslipsPage() {
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}><View style={styles.body}><PayslipsScreen /></View></ScrollView>
    <AdminBottomNavigation />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, minWidth: 0, backgroundColor: '#f3f9f8' }, content: { padding: 20, paddingBottom: 36 },
  body: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
});
