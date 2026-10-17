import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminBottomNavigation } from './AdminBottomNavigation';
import { AppIcon } from './AppIcon';
import { useAdminLayout } from './useAdminLayout';
import { useAdminViewport } from './useAdminViewport';

export function AdminUnavailablePage({ title, message }: { title: string; message: string }) {
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const { desktop } = useAdminViewport();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safe}>
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <AppIcon name="info" size={24} color="#607591" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </ScrollView>
      {!desktop && <AdminBottomNavigation />}
    </View>
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f8fd' },
  page: { flex: 1, width: '100%', alignSelf: 'center' },
  content: { padding: 20, paddingTop: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: '600', color: '#20334f' },
  card: { padding: 24, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', gap: 12 },
  message: { fontSize: 14, lineHeight: 22, color: '#607591' },
});
