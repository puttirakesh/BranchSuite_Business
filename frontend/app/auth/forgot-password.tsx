
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";
import { colors } from "../../src/shared/theme/colors";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");

    Alert.alert(
      "UI Demo",
      "Password reset email functionality will be connected by your backend developer."
    );
  };

  return (
    <AuthScreen>
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <View style={styles.iconBox}>
        <Text style={styles.icon}>✉</Text>
      </View>

      <Text style={styles.title}>
        Forgot password?
      </Text>

      <Text style={styles.subtitle}>
        Enter your registered work email address.
        We'll help you reset your password.
      </Text>

      <View style={styles.card}>
        <AppInput
          label="Work email"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          error={error}
        />

        <AppButton
          title="Send Reset Link"
          onPress={handleReset}
        />
      </View>

      <Pressable
        onPress={() => router.replace("/auth/login")}
        style={styles.returnLink}
      >
        <Text style={styles.returnText}>
          Back to Sign In
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    marginBottom: 32,
    paddingVertical: 8,
  },
  backText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
  iconBox: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  icon: {
    color: colors.primary,
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
  },
  returnLink: {
    alignSelf: "center",
    marginTop: 25,
    paddingVertical: 8,
  },
  returnText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
});
