import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/core/auth/AuthProvider";
import { workspaceHome } from "../src/features/subscriptions/access";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>;
  }
  if (!session) return <Redirect href="/auth/login" />;
  // Single routing rule shared with login and the layouts: an inactive
  // subscription goes to billing, never to a dashboard that can only 403.
  return <Redirect href={workspaceHome(session)} />;
}
