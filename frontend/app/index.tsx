import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/core/auth/AuthProvider";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>;
  }
  if (!session) return <Redirect href="/auth/login" />;
  const isEmployeeOnly = session.memberships.every(
    (membership) => membership.role === "EMPLOYEE"
  );
  return <Redirect href={isEmployeeOnly ? "/employee" : "/admin"} />;
}
