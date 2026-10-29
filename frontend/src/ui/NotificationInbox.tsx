import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { api } from '../core/api/client';
import { apiErrorMessage } from '../core/admin/http';
import { useEmployeeStyles } from '../features/employee/styles';
import { RefreshButton } from '../features/employee/components';

type Notice = { id: string; title: string; message: string; href: string; readAt: string | null; createdAt: string };
export function NotificationInbox() {
  const s = useEmployeeStyles();
  const router = useRouter();
  const staff = usePathname().startsWith('/admin');
  const [items, setItems] = React.useState<Notice[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [reload, setReload] = React.useState(0);
  useFocusEffect(React.useCallback(() => {
    let active = true; setLoading(true); setError('');
    api.get<Notice[]>('/notifications').then(result => { if (active) setItems(result.data); })
      .catch(cause => { if (active) setError(apiErrorMessage(cause, 'Unable to load notifications.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]));
  async function open(item: Notice) {
    try {
      await api.patch(`/notifications/${item.id}/read`);
      let href = item.href;
      if (staff) href = href.replace('/employee/leave', '/admin/my-leave').replace('/employee/attendance/correction', '/admin/attendance').replace('/employee/tasks/', '/admin/my-tasks/');
      router.push(href as never);
    } catch (cause) { setError(apiErrorMessage(cause, 'Unable to open notification.')); }
  }
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <View style={s.between}><Text style={s.cardTitle}>Notifications</Text><RefreshButton label="Refresh notifications" loading={loading} onPress={() => setReload(value => value + 1)} /></View>
    {loading && <ActivityIndicator />}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {!loading && !error && !items.length && <Text style={s.small}>Your workflow updates will appear here.</Text>}
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => { void open(item); }} style={[s.card, { gap: 6 }]}>
      <Text style={s.cardTitle}>{item.readAt ? '' : '• '}{item.title}</Text>
      <Text style={s.body}>{item.message}</Text>
      <Text style={s.small}>{new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Text>
    </Pressable>)}
  </ScrollView>;
}
