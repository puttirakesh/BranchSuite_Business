import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import axios from "axios";
import AppButton from "../../../shared/components/AppButton";
import { getApiErrorMessage } from "../../../core/api/api-error";
import { breakpoints, colors } from "../../../theme/tokens";

import { useAuth } from "../../../core/auth/AuthContext";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (busy) return;

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setBusy(true);

      await login(cleanEmail, password);
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 401
        ? "Invalid email or password."
        : getApiErrorMessage(err, "Unable to sign in. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const isWide = width >= breakpoints.form;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.card, isWide && styles.desktopCard]}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandLetter}>B</Text>
          </View>

          <Text style={styles.brandName}>BranchSuite</Text>
          <Text style={styles.brandSubtitle}>SuperAdmin Portal</Text>

          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.description}>
            Sign in to manage your BranchSuite platform.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>

            <TextInput
              style={styles.input}
              placeholder="admin@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
              maxLength={254}
              accessibilityLabel="Email address"
            />

            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                accessibilityLabel="Password"
                onSubmitEditing={handleLogin}
              />

              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.showButton}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <Text style={styles.showText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            <AppButton title="Sign in" onPress={handleLogin} loading={busy} />
          </View>

          <Text style={styles.footer}>BranchSuite Platform Administration</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    padding: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E7E9F3",
  },
  desktopCard: {
    padding: 40,
  },
  brandIcon: {
    width: 56,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  brandLetter: {
    fontSize: 29,
    fontWeight: "800",
    color: colors.surface,
  },
  brandName: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.heading,
    textAlign: "center",
    marginTop: 16,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    marginTop: 34,
  },
  description: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 21,
  },
  form: {
    marginTop: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
    backgroundColor: colors.surface,
  },
  passwordContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text,
  },
  showButton: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  showText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.dangerBackground,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 32,
  },
});
