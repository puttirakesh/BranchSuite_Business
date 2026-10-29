import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useRouter } from "expo-router";

import { useAuth } from "../../src/core/auth/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, loading, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;

    if (user.role === "PLATFORM_ADMIN") {
      router.replace("/(admin)/dashboard");
    }

    // Support navigation will be connected to the
    // protected Support workspace in the next step.
  }, [user, loading, router]);

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

      const account = await login(cleanEmail, password);

      if (account.role === "PLATFORM_ADMIN") {
        router.replace("/(admin)/dashboard");
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          setError("Invalid email or password.");
        } else if (err.response?.status === 403) {
          setError("Your account is not permitted to sign in.");
        } else if (!err.response) {
          setError(
            "Cannot connect to the server. Check your network and backend.",
          );
        } else {
          setError("Unable to sign in. Please try again.");
        }
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const isWide = width >= 700;

  if (loading) {
    return (
      <View style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#6950C8" />
        <Text style={styles.loadingText}>Restoring session...</Text>
      </View>
    );
  }

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

            {user?.role === "PLATFORM_SUPPORT" && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>
                  Support account authenticated. Support workspace navigation is
                  not connected yet.
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.pressedButton,
                busy && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>
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
    backgroundColor: "#F5F6FC",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F6FC",
  },
  loadingText: {
    marginTop: 14,
    color: "#64748B",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#6950C8",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  brandLetter: {
    fontSize: 29,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  brandName: {
    fontSize: 25,
    fontWeight: "800",
    color: "#251C45",
    textAlign: "center",
    marginTop: 16,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#6950C8",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 34,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
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
    borderColor: "#DCE1EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
  },
  passwordContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE1EB",
    borderRadius: 12,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1E293B",
  },
  showButton: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  showText: {
    color: "#6950C8",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FFF1F2",
    marginBottom: 16,
  },
  errorText: {
    color: "#BE123C",
    fontSize: 13,
    lineHeight: 19,
  },
  noticeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    marginBottom: 16,
  },
  noticeText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6950C8",
  },
  pressedButton: {
    opacity: 0.85,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 32,
  },
});
