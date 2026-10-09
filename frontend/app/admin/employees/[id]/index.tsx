import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";

export default function ComingSoonScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>B</Text>
        </View>

        <Text style={styles.title}>
          Coming Soon
        </Text>

        <Text style={styles.subtitle}>
          We're building this feature for BranchSuite.
          It will be available after backend integration.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.replace("/admin")}
        >
          <Text style={styles.buttonText}>
            Back to Dashboard
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FB",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    padding: 28,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  iconBox: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#155E75",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  icon: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 12,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 26,
    backgroundColor: "#155E75",
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
