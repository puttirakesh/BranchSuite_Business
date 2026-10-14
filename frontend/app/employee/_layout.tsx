import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../../src/core/auth/AuthProvider';
import { EmployeeWorkspaceProvider } from '../../src/features/employee/workspace';
import { EmployeeShell } from '../../src/features/employee/shell';

export default function EmployeeLayout() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/auth/login" />;
  if (!session.memberships.some(m => m.role === 'EMPLOYEE')) return <Redirect href="/admin" />;
  return <EmployeeWorkspaceProvider><EmployeeShell /></EmployeeWorkspaceProvider>;
}
