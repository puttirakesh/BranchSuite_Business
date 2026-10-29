import { ActivityIndicator, Text, View } from 'react-native';
export default function LoadingState({ message = 'Loading?' }: { message?: string }) { return <View style={{ padding: 24, alignItems: 'center', gap: 16 }}><ActivityIndicator color="#6947B8" /><Text>{message}</Text></View>; }
