import React from 'react';
import { Text, View } from 'react-native';
import type { SupportTicketHistoryDto } from '../../core/admin/workspace-records.api';

export function SupportHistory({ history }: { history?: SupportTicketHistoryDto[] }) {
  if (!history?.length) return null;
  return <View style={{ gap: 8 }}>
    <Text style={{ fontSize: 13, fontWeight: '700', color: '#20334f' }}>Ticket history</Text>
    {history.map(event => <View key={event.id} style={{ gap: 3 }}>
      <Text style={{ fontSize: 13, color: '#20334f' }}>{event.summary}</Text>
      <Text style={{ fontSize: 11, color: '#607591' }}>{event.actorName} · {new Date(event.createdAt).toLocaleString('en-IN')}</Text>
    </View>)}
  </View>;
}
