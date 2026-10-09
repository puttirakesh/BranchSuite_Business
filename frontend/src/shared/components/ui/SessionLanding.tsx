import React from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../../core/auth/AuthProvider";
import AppButton from "./AppButton";
import { colors } from "../../theme/colors";

type Props = { portal: "Business & Staff" | "Employee" };

export default function SessionLanding({ portal }: Props) {
  const { session, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/auth/login");
  }

  if (!session) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{portal} login successful</Text>
      <Text style={styles.subtitle}>Signed in as {session.user.name}</Text>
      <Text style={styles.email}>{session.user.email}</Text>
      <Text style={styles.section}>Authorized businesses</Text>
      {session.memberships.map((membership) => (
        <View key={membership.id} style={styles.card}>
          <Text style={styles.business}>{membership.companyName}</Text>
          <Text style={styles.role}>{membership.role}</Text>
          <Text style={styles.branches}>
            Branches: {membership.branches.map((b) => b.name).join(", ") || "None"}
          </Text>
        </View>
      ))}
      <Text style={styles.note}>
        This is a temporary landing screen for testing authentication.
        Business modules will be connected separately.
      </Text>
      <AppButton title="Sign Out" onPress={handleLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background },
  heading: { color: colors.text, fontWeight: "800", fontSize: 23, marginBottom: 10 },
  subtitle: { color: colors.text, fontSize: 17 },
  email: { color: colors.muted, fontSize: 14, marginBottom: 20 },
  section: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 12 },
  business: { color: colors.text, fontWeight: "700", fontSize: 16 },
  role: { color: colors.primary, fontSize: 13, marginTop: 4 },
  branches: { color: colors.muted, fontSize: 13, marginTop: 6 },
  note: { color: colors.muted, fontSize: 13, marginBottom: 20, marginTop: 4 },
});
