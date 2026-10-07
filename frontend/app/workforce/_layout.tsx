import { Stack } from 'expo-router';
import { WorkforceSessionProvider } from '../../src/features/workforce/session';

export default function WorkforceLayout() {
  return <WorkforceSessionProvider><Stack screenOptions={{ headerShown: true, headerTintColor: '#087F76', headerTitle: 'Workforce' }}>
    <Stack.Screen name="index" options={{ title: 'Business overview', headerShown: false }} />
    <Stack.Screen name="account" options={{ title: 'Account & branches' }} />
    <Stack.Screen name="[resource]/index" options={{ title: 'Branch records' }} />
    <Stack.Screen name="[resource]/new" options={{ title: 'New record' }} />
    <Stack.Screen name="[resource]/[id]/index" options={{ title: 'Record details' }} />
    <Stack.Screen name="[resource]/[id]/edit" options={{ title: 'Edit record' }} />
  </Stack></WorkforceSessionProvider>;
}
