import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/core/auth/AuthProvider";

export default function AdminLayout() {
  const { session, loading } = useAuth();
  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
  if (!session) return <Redirect href="/auth/login" />;
  if (!session.memberships.some((m) => m.role !== "EMPLOYEE")) {
    return <Redirect href="/employee" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
