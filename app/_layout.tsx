import { Slot } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BranchSuiteProvider } from '../src/core/providers/AppProviders';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6FF' }}>
        <StatusBar style="dark" />
        <BranchSuiteProvider><Slot /></BranchSuiteProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
