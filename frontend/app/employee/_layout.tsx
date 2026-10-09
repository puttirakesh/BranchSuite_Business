import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/core/auth/AuthProvider";

export default function EmployeeLayout() {
  const { session, loading } = useAuth();
  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
  if (!session) return <Redirect href="/auth/login" />;
  if (!session.memberships.every((m) => m.role === "EMPLOYEE")) {
    return <Redirect href="/admin" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
