import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ScrollView contentContainerStyle={styles.page}>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>This screen couldn’t load</Text>
      <Text style={styles.message}>Please try opening it again. Your saved records are still available.</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f3f9f8' },
  card: { alignSelf: 'center', width: '100%', maxWidth: 480, padding: 24, borderRadius: 16, backgroundColor: '#fff', gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#152b3c' }, message: { fontSize: 15, lineHeight: 23, color: '#586d7c' },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: '#007f75', borderRadius: 9 },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
