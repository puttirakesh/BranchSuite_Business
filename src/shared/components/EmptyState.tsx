import { Text, View } from 'react-native';
export default function EmptyState({ title = 'No results', message = 'Try another search.' }: { title?: string; message?: string }) { return <View style={{ padding: 24, gap: 8 }}><Text style={{ fontSize: 18, fontWeight: '700' }}>{title}</Text><Text>{message}</Text></View>; }
