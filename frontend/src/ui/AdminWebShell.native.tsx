import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminWorkspaceHeader } from "./AdminWorkspaceHeader";
import { colors } from "../shared/theme/colors";

/** Keep the shared header below Android status bars and display cutouts. */
export function AdminWebShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.shell}>
      <AdminWorkspaceHeader />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.surface },
  content: { flex: 1, minWidth: 0, minHeight: 0, backgroundColor: colors.background },
});
