
import React, { useState } from "react";

import {
  ActivityIndicator,
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

import {
  forgotPasswordApi,
} from "../../src/core/api/client";

// =====================================================
// EMAIL VALIDATION
// =====================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =====================================================
// FORGOT PASSWORD SCREEN
// =====================================================

export default function ForgotPasswordScreen() {
  const router = useRouter();

  // =====================================================
  // STATE
  // =====================================================

  const [email, setEmail] = useState("");

  const [error, setError] = useState("");

  const [apiError, setApiError] = useState("");

  const [loading, setLoading] = useState(false);

  const [requestCompleted, setRequestCompleted] =
    useState(false);

  // =====================================================
  // EMAIL INPUT HANDLER
  // =====================================================

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (error) {
      setError("");
    }

    if (apiError) {
      setApiError("");
    }

    if (requestCompleted) {
      setRequestCompleted(false);
    }
  };

  // =====================================================
  // VALIDATE EMAIL
  // =====================================================

  const validateEmail = (): boolean => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Work email is required.");
      return false;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return false;
    }

    if (normalizedEmail.length > 254) {
      setError("Email address is too long.");
      return false;
    }

    setError("");

    return true;
  };

  // =====================================================
  // HANDLE FORGOT PASSWORD
  // =====================================================

  const handleReset = async () => {
    if (loading) {
      return;
    }

    if (!validateEmail()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    setApiError("");
    setRequestCompleted(false);

    try {
      // Call NestJS backend.
      //
      // POST /api/v1/auth/forgot-password
      //
      // Backend generates a reset token and sends
      // an email through Nodemailer for eligible
      // registered accounts.

      await forgotPasswordApi(normalizedEmail);

      // The backend intentionally returns the same
      // response for registered and unregistered
      // emails to protect account privacy.

      setRequestCompleted(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setApiError(
            "Unable to connect to the server. " +
              "Check your internet connection and " +
              "make sure the backend is running."
          );
        } else if (err.response.status === 429) {
          setApiError(
            "Too many requests. Please wait a few " +
              "minutes before trying again."
          );
        } else if (err.response.status >= 500) {
          setApiError(
            "The server is temporarily unavailable. " +
              "Please try again later."
          );
        } else {
          setApiError(
            "Unable to process your request. " +
              "Please check your email and try again."
          );
        }
      } else {
        setApiError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // NAVIGATE TO RESET PASSWORD
  // =====================================================

  const handleGoToResetPassword = () => {
    router.push({
      pathname: "/auth/reset-password",
      params: {
        email: email.trim().toLowerCase(),
      },
    });
  };

  // =====================================================
  // NAVIGATE TO LOGIN
  // =====================================================

  const handleBackToLogin = () => {
    router.replace("/auth/login");
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <AuthScreen>
      {/* BACK BUTTON */}

      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        disabled={loading}
      >
        <Text style={styles.backText}>
          ‹ Back
        </Text>
      </Pressable>

      {/* ICON */}

      <View style={styles.iconBox}>
        <Text style={styles.icon}>
          ✉
        </Text>
      </View>

      {/* TITLE */}

      <Text style={styles.title}>
        Forgot password?
      </Text>

      {/* SUBTITLE */}

      <Text style={styles.subtitle}>
        Enter your registered work email address.
        We'll help you reset your password securely.
      </Text>

      {/* MAIN CARD */}

      <View style={styles.card}>
        {!requestCompleted ? (
          <>
            {/* EMAIL INPUT */}

            <AppInput
              label="Work email"
              placeholder="name@company.com"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoComplete="email"
              error={error}
            />

            {/* API ERROR */}

            {apiError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {apiError}
                </Text>
              </View>
            ) : null}

            {/* LOADING INDICATOR */}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text style={styles.loadingText}>
                  Processing your request...
                </Text>
              </View>
            ) : null}

            {/* SEND RESET EMAIL BUTTON */}

            <AppButton
              title={
                loading
                  ? "Please Wait..."
                  : "Send Reset Email"
              }
              onPress={handleReset}
            />

            {/* HELP TEXT */}

            <Text style={styles.helperText}>
              If an eligible account exists for this
              email, we'll send password reset
              instructions.
            </Text>
          </>
        ) : (
          <>
            {/* SUCCESS ICON */}

            <View style={styles.successIconBox}>
              <Text style={styles.successIcon}>
                ✓
              </Text>
            </View>

            {/* SUCCESS TITLE */}

            <Text style={styles.successTitle}>
              Check your email
            </Text>

            {/* SUCCESS MESSAGE */}

            <Text style={styles.successDescription}>
              If an eligible BranchSuite Business
              account exists for this email, password
              reset instructions will be sent to:
            </Text>

            {/* EMAIL ADDRESS */}

            <Text style={styles.emailText}>
              {email.trim().toLowerCase()}
            </Text>

            {/* INSTRUCTIONS */}

            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>
                What to do next
              </Text>

              <Text style={styles.instructionText}>
                1. Open your email inbox.
              </Text>

              <Text style={styles.instructionText}>
                2. Find the BranchSuite Business
                password reset email.
              </Text>

              <Text style={styles.instructionText}>
                3. Copy the password reset token.
              </Text>

              <Text style={styles.instructionText}>
                4. Enter the token and your new
                password on the next screen.
              </Text>
            </View>

            {/* TOKEN EXPIRATION */}

            <Text style={styles.expiryText}>
              The reset token is valid for 30 minutes
              and can only be used once.
            </Text>

            {/* NAVIGATE TO RESET PASSWORD */}

            <AppButton
              title="Enter Reset Token"
              onPress={handleGoToResetPassword}
            />

            {/* RESEND EMAIL */}

            <Pressable
              onPress={() => {
                setRequestCompleted(false);
                setApiError("");
              }}
              style={styles.resendLink}
            >
              <Text style={styles.resendText}>
                Didn't receive the email? Try again
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* BACK TO LOGIN */}

      <Pressable
        onPress={handleBackToLogin}
        style={styles.returnLink}
        disabled={loading}
      >
        <Text style={styles.returnText}>
          Back to Sign In
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

// =====================================================
// STYLES
// =====================================================

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

  // =====================================================
  // LOADING STYLES
  // =====================================================

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 10,
  },

  loadingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },

  // =====================================================
  // ERROR STYLES
  // =====================================================

  errorBox: {
    backgroundColor: "#FFF1F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  errorText: {
    color: "#BE123C",
    fontSize: 13,
    lineHeight: 20,
  },

  // =====================================================
  // SUCCESS STYLES
  // =====================================================

  successIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  successIcon: {
    color: "#15803D",
    fontSize: 28,
    fontWeight: "800",
  },

  successTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },

  successDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  emailText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },

  // =====================================================
  // INSTRUCTION STYLES
  // =====================================================

  instructionBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  instructionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },

  instructionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 7,
  },

  expiryText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
  },

  // =====================================================
  // HELPER TEXT
  // =====================================================

  helperText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 14,
  },

  // =====================================================
  // RESEND LINK
  // =====================================================

  resendLink: {
    alignSelf: "center",
    paddingVertical: 12,
    marginTop: 12,
  },

  resendText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },

  // =====================================================
  // LOGIN LINK
  // =====================================================

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

