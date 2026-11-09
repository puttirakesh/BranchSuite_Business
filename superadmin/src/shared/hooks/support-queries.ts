import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../core/auth/AuthContext';
import { env } from '../../core/config/env';
import { can } from '../../core/permissions/roles';
import { advancedSupportApi, type BusinessQuery } from '../../features/support/api/advanced.api';

/** Focus/auth/app-state gates bound polling and remove every listener on unmount. */
export function useSupportFocus() {
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
  return focused && active && !!user && can(user.role, 'support.view');
}

export function useSupportSummary() {
  const focused = useSupportFocus(); const { user } = useAuth();
  return useQuery({ queryKey: ['support-summary', user?.id], queryFn: advancedSupportApi.summary, enabled: focused && env.dataMode === 'api', refetchInterval: focused ? 30000 : false, refetchIntervalInBackground: false });
}
export function useSupportAgents() {
  const focused = useSupportFocus();
  return useQuery({ queryKey: ['support-agents'], queryFn: advancedSupportApi.agents, enabled: focused && env.dataMode === 'api', staleTime: 30000 });
}
export function useSupportBusinesses(q: BusinessQuery) {
  const { user } = useAuth(); const focused = useSupportFocus();
  return useQuery({ queryKey: ['support-businesses', q], queryFn: () => advancedSupportApi.businesses(q), enabled: focused && env.dataMode === 'api' && can(user?.role, 'support.businesses.view') });
}
export function useSupportBusiness(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['support-business', id], queryFn: () => advancedSupportApi.business(id), enabled: !!id && env.dataMode === 'api' && can(user?.role, 'support.businesses.view') });
}
export function useSupportAction() {
  const client = useQueryClient();
  return useMutation({ mutationFn: advancedSupportApi.action, onSuccess: async (_data, variables) => {
    const roots = variables.path.endsWith('/read') ? ['tickets', 'support-summary', 'metrics'] : ['tickets', 'ticket', 'support-summary', 'metrics', 'support-businesses', 'support-business', 'support-agents'];
    await Promise.all(roots.map(root => client.invalidateQueries({ queryKey: [root] })));
  } });
}
