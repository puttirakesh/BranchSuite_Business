import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Pill, PressableCard } from '../../../shared/components';
import type { Ticket } from '../types';

export function TicketRow({ ticket }: { ticket: Ticket }) {
  const meta = [ticket.customerName ?? ticket.category, ticket.id.length > 14 ? ticket.id.slice(0, 8) : ticket.id, ticket.priority === 'High' || ticket.priority === 'Urgent' ? ticket.priority + ' priority' : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressableCard onPress={() => router.push(('/support/' + encodeURIComponent(ticket.id)) as never)} accessibilityLabel={ticket.subject + ', ' + ticket.status}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{ticket.subject}</AppText>
          <AppText variant="small">{meta}</AppText>
        </View>
        <Pill label={ticket.status} />
      </View>
    </PressableCard>
  );
}
