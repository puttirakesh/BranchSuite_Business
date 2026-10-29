import { Text, View } from 'react-native';
import AppCard from '../../../shared/components/AppCard';
import type { TicketMessage } from '../types';
export default function TicketConversation({ messages }: { messages: TicketMessage[] }) { return <View style={{ gap: 12 }}>{messages.map((m,i) => <AppCard key={i}><Text style={{ fontWeight: '700' }}>{m.by}{m.internal ? ' ? Internal note' : ''}</Text><Text>{m.text}</Text><Text>{m.time}</Text></AppCard>)}</View>; }
