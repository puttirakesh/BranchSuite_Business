import React from 'react';
import { Text, View } from 'react-native';

/** Public projection only: no staff names, reasons, SLA promises or internal read state. */
export function SupportTracking({ ticket }: { ticket: { assignedToSupport?: boolean; escalationStage?: string } }) {
  return <View style={{ gap: 4 }}>
    <Text style={{ fontSize: 12, color: '#405573' }}>{ticket.assignedToSupport ? 'Assigned to Support' : 'Waiting for Support assignment'}</Text>
    {ticket.escalationStage && ticket.escalationStage !== 'NONE' ? <Text style={{ fontSize: 12, color: '#405573' }}>Escalation: {ticket.escalationStage === 'REQUESTED' ? 'Requested' : ticket.escalationStage === 'ACKNOWLEDGED' ? 'In review' : 'Completed'}</Text> : null}
  </View>;
}
