import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthProvider';
import { AdminWebShell } from '../../src/ui/AdminWebShell';

export default function AdminLayout() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
  if (!session) return <Redirect href="/auth/login" />;
  // Employee-only accounts use the employee workspace (mirrors app/index.tsx).
  if (session.memberships.every(membership => membership.role === 'EMPLOYEE')) return <Redirect href="/employee" />;
  return <AdminWebShell><Stack screenOptions={{ headerShown: false }} /></AdminWebShell>;
}
