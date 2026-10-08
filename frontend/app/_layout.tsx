import { Stack } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/store/session";
import { Button, StateView } from "../src/components/ui";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F8FC" }}>
        <SessionProvider>
          <Navigator />
        </SessionProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Navigator() {
  const { session, loading, error, retry, logout, portal } = useSession();
  if (loading) return <StateView loading title="Opening your workspace…" />;
  if (error)
    return (
      <View style={{ flex: 1 }}>
        <StateView
          title="Unable to restore session"
          message={error}
          action="Try again"
          onAction={retry}
        />
        <Button
          title="Return to sign in"
          onPress={() => {
            void logout().then(retry);
          }}
          variant="secondary"
        />
      </View>
    );
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session && portal === "staff"}>
        <Stack.Screen name="(business)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && portal === "employee"}>
        <Stack.Screen name="employee" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
    </Stack>
  );
}
