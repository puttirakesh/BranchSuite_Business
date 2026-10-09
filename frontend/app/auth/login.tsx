
import React, { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useRouter } from "expo-router";
import axios from "axios";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";

import { colors } from "../../src/shared/theme/colors";
import { useAuth } from "../../src/core/auth/AuthProvider";

// =====================================================
// LOGIN TYPES
// =====================================================

type LoginRole = "business" | "employee";

type LoginErrors = {
  email: string;
  password: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =====================================================
// LOGIN SCREEN
// =====================================================

export default function LoginScreen() {
  const router = useRouter();

  const { signIn, loading } = useAuth();

  // =====================================================
  // STATE
  // =====================================================

  const [role, setRole] = useState<LoginRole>("business");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<LoginErrors>({
    email: "",
    password: "",
  });

  const isBusy = submitting || loading;

  // =====================================================
  // EMAIL INPUT HANDLER
  // =====================================================

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (errors.email) {
      setErrors((current) => ({
        ...current,
        email: "",
      }));
    }
  };

  // =====================================================
  // PASSWORD INPUT HANDLER
  // =====================================================

  const handlePasswordChange = (value: string) => {
    setPassword(value);

    if (errors.password) {
      setErrors((current) => ({
        ...current,
        password: "",
      }));
    }
  };

  // =====================================================
  // SELECT LOGIN ROLE
  // =====================================================

  const handleRoleChange = (value: LoginRole) => {
    if (isBusy) {
      return;
    }

    setRole(value);

    setErrors({
      email: "",
      password: "",
    });
  };

  // =====================================================
  // VALIDATE LOGIN FORM
  // =====================================================

  const validate = (): boolean => {
    const normalizedEmail = email.trim().toLowerCase();

    const nextErrors: LoginErrors = {
      email: "",
      password: "",
    };

    if (!normalizedEmail) {
      nextErrors.email = "Work email is required.";
    } else if (
      !EMAIL_REGEX.test(normalizedEmail) ||
      normalizedEmail.length > 254
    ) {
      nextErrors.email = "Enter a valid work email.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  // =====================================================
  // HANDLE LOGIN
  // =====================================================

  const handleLogin = async () => {
    if (isBusy) {
      return;
    }

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const portal =
        role === "business" ? "staff" : "employee";

      // Authenticate through AuthProvider.
      //
      // AuthProvider handles the existing login
      // API and session persistence.

      await signIn(
        email.trim().toLowerCase(),
        password,
        portal
      );

      // Clear the password field.
      setPassword("");

      // Navigate to the appropriate portal.
      if (role === "business") {
        router.replace("/admin");
      } else {
        router.replace("/employee");
      }
    } catch (error: unknown) {
      let message =
        "Unable to sign in. Please try again.";

      if (axios.isAxiosError(error)) {
        if (!error.response) {
          message =
            "Can't reach the server. Check your Wi-Fi, " +
            "API URL, and backend status.";
        } else {
          const serverMessage: unknown =
            error.response.data?.message;

          if (Array.isArray(serverMessage)) {
            message = serverMessage.join("\n");
          } else if (typeof serverMessage === "string") {
            message = serverMessage;
          } else if (error.response.status === 401) {
            message =
              "Invalid credentials or portal selection.";
          } else if (error.response.status >= 500) {
            message =
              "The server is temporarily unavailable. " +
              "Please try again later.";
          }
        }
      } else if (error instanceof Error) {
        message = error.message;
      }

      Alert.alert("Sign in failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // FORGOT PASSWORD NAVIGATION
  // =====================================================

  const handleForgotPassword = () => {
    if (isBusy) {
      return;
    }

    // Opens the Forgot Password screen.
    //
    // That screen calls:
    // POST /api/v1/auth/forgot-password
    //
    // The user can then navigate to the
    // Reset Password screen.

    router.push("/auth/forgot-password");
  };

  // =====================================================
  // SUBSCRIPTION PLANS NAVIGATION
  // =====================================================

  const handleExplorePlans = () => {
    if (isBusy) {
      return;
    }

    router.push("/auth/plans");
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <AuthScreen>
      {/* BRAND HEADER */}

      <View style={styles.logoBox}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>
            B
          </Text>
        </View>

        <Text style={styles.brand}>
          BranchSuite
        </Text>

        <Text style={styles.tagline}>
          CRM • PEOPLE • PAYROLL
        </Text>
      </View>

      {/* LOGIN CARD */}

      <View style={styles.card}>
        <Text style={styles.heading}>
          Welcome back
        </Text>

        <Text style={styles.subtitle}>
          Sign in to manage your business and
          daily work.
        </Text>

        {/* LOGIN PORTAL TABS */}

        <View style={styles.tabs}>
          {(
            [
              ["business", "Business & Staff"],
              ["employee", "Employee"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              disabled={isBusy}
              onPress={() => handleRoleChange(value)}
              style={[
                styles.tab,
                role === value && styles.activeTab,
              ]}
              accessibilityRole="tab"
              accessibilityState={{
                selected: role === value,
                disabled: isBusy,
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  role === value &&
                    styles.activeTabText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* EMAIL INPUT */}

        <AppInput
          label="Work email"
          placeholder="name@company.com"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />

        {/* PASSWORD INPUT */}

        <AppInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={handlePasswordChange}
          password
          error={errors.password}
        />

        {/* FORGOT PASSWORD LINK */}

        <Pressable
          style={styles.forgot}
          disabled={isBusy}
          onPress={handleForgotPassword}
          accessibilityRole="button"
          accessibilityLabel="Forgot password"
          accessibilityState={{
            disabled: isBusy,
          }}
        >
          <Text style={styles.link}>
            Forgot password?
          </Text>
        </Pressable>

        {/* SIGN IN BUTTON */}

        <AppButton
          title={
            submitting
              ? "Signing in..."
              : "Sign In"
          }
          onPress={handleLogin}
          disabled={isBusy}
        />

        {/* LOADING INDICATOR */}

        {submitting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Signing in securely...
            </Text>
          </View>
        ) : null}

        {/* DIVIDER */}

        <View style={styles.divider}>
          <View style={styles.line} />

          <Text style={styles.or}>
            OR
          </Text>

          <View style={styles.line} />
        </View>

        {/* SUBSCRIPTION PLANS */}

        <AppButton
          title="Explore Subscription Plans"
          variant="outline"
          disabled={isBusy}
          onPress={handleExplorePlans}
        />
      </View>

      {/* FOOTER */}

      <Text style={styles.footer}>
        © BranchSuite • Business Management
      </Text>
    </AuthScreen>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  logoBox: {
    alignItems: "center",
    marginBottom: 28,
  },

  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  logoLetter: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  brand: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },

  tagline: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 5,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },

  heading: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 22,
  },

  // =====================================================
  // LOGIN ROLE TABS
  // =====================================================

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },

  tab: {
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 4,
  },

  activeTab: {
    backgroundColor: colors.primary,
  },

  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  activeTabText: {
    color: "#FFFFFF",
  },

  // =====================================================
  // FORGOT PASSWORD LINK
  // =====================================================

  forgot: {
    alignSelf: "flex-end",
    marginBottom: 22,
    paddingVertical: 4,
  },

  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  // =====================================================
  // LOADING INDICATOR
  // =====================================================

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 12,
  },

  // =====================================================
  // DIVIDER
  // =====================================================

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  or: {
    color: colors.muted,
    fontSize: 12,
  },

  // =====================================================
  // FOOTER
  // =====================================================

  footer: {
    textAlign: "center",
    marginTop: 26,
    color: colors.muted,
    fontSize: 11,
  },
});
