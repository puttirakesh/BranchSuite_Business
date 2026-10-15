
import React from "react";
import {
  ActivityIndicator,
  View,
} from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "../../src/core/auth/AuthProvider";
import { EmployeeWorkspaceProvider } from "../../src/features/employee/workspace";
import { EmployeeShell } from "../../src/features/employee/shell";

export default function EmployeeLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth/login" />;
  }

  const isEmployeeOnly =
    session.memberships.length > 0 &&
    session.memberships.every(
      (membership) => membership.role === "EMPLOYEE"
    );

  if (!isEmployeeOnly) {
    return <Redirect href="/admin" />;
  }

  return (
    <EmployeeWorkspaceProvider>
      <EmployeeShell />
    </EmployeeWorkspaceProvider>
  );
}
