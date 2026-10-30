import { Redirect } from 'expo-router';
import { useAuth } from '../../core/auth/AuthContext';
import { hasPermission } from '../../core/permissions/permissions';
import type { Module } from '../../core/permissions/role-rules';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
export default function ProtectedLayout({ module, children }: { module: Module; children: React.ReactNode }) { const { account, ready } = useAuth(); if (!ready) return <LoadingState />; if (!account) return <Redirect href="/login" />; return hasPermission(account,module) ? children : <ErrorState message="This module requires a platform owner account." />; }
