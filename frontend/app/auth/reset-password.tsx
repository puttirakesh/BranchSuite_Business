
import React, { useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";

import { colors } from "../../src/shared/theme/colors";

import {
  resetPasswordApi,
} from "../../src/core/api/client";

// =====================================================
// VALIDATION CONSTANTS
// =====================================================

const RESET_TOKEN_REGEX = /^[a-f0-9]{64}$/i;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// =====================================================
// RESET PASSWORD SCREEN
// =====================================================

export default function ResetPasswordScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    email?: string;
    token?: string;
  }>();

  // =====================================================
  // STATE
  // =====================================================

  const [token, setToken] = useState(
    typeof params.token === "string"
      ? params.token
      : ""
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [tokenError, setTokenError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [apiError, setApiError] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetCompleted, setResetCompleted] =
    useState(false);

  // =====================================================
  // EMAIL PARAMETER
  // =====================================================

  const email =
    typeof params.email === "string"
      ? params.email.trim().toLowerCase()
      : "";

  // =====================================================
  // TOKEN INPUT
  // =====================================================

  const handleTokenChange = (value: string) => {
    setToken(value);
    setTokenError("");
    setApiError("");
  };

  // =====================================================
  // NEW PASSWORD INPUT
  // =====================================================

  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordError("");
    setConfirmError("");
    setApiError("");
  };

  // =====================================================
  // CONFIRM PASSWORD INPUT
  // =====================================================

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmError("");
    setApiError("");
  };

  // =====================================================
  // VALIDATE FORM
  // =====================================================

  const validateForm = (): boolean => {
    let isValid = true;

    const normalizedToken = token.trim();

    setTokenError("");
    setPasswordError("");
    setConfirmError("");

    if (!normalizedToken) {
      setTokenError("Password reset token is required.");
      isValid = false;
    } else if (!RESET_TOKEN_REGEX.test(normalizedToken)) {
      setTokenError(
        "Enter the complete 64-character reset token from your email."
      );
      isValid = false;
    }

    if (!newPassword) {
      setPasswordError("New password is required.");
      isValid = false;
    } else if (
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword.length > MAX_PASSWORD_LENGTH
    ) {
      setPasswordError(
        "Password must contain 8 to 128 characters."
      );
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your new password.");
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      isValid = false;
    }

    return isValid;
  };

  // =====================================================
  // HANDLE RESET PASSWORD
  // =====================================================

  const handleResetPassword = async () => {
    if (loading || resetCompleted) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setApiError("");

    try {
      // POST /api/v1/auth/reset-password
      //
      // Backend verifies the reset token,
      // hashes the new password using bcrypt,
      // updates PostgreSQL, and invalidates
      // the used reset token.

      await resetPasswordApi({
        token: token.trim(),
        newPassword,
        confirmPassword,
      });

      // Clear sensitive form fields.
      setToken("");
      setNewPassword("");
      setConfirmPassword("");

      setResetCompleted(true);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          setApiError(
            "Unable to connect to the server. " +
              "Check your internet connection and " +
              "make sure the backend is running."
          );
        } else if (
          err.response.status === 400 ||
          err.response.status === 401
        ) {
          const backendMessage =
            err.response.data?.message;

          setApiError(
            typeof backendMessage === "string"
              ? backendMessage
              : "The reset token is invalid or expired. " +
                  "Please request a new one."
          );
        } else if (err.response.status === 429) {
          setApiError(
            "Too many attempts. Please wait before trying again."
          );
        } else if (err.response.status >= 500) {
          setApiError(
            "The server is temporarily unavailable. " +
              "Please try again later."
          );
        } else {
          setApiError(
            "Unable to reset your password. Please try again."
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
  // NAVIGATION
  // =====================================================

  const handleBackToLogin = () => {
    router.replace("/auth/login");
  };

  const handleRequestNewToken = () => {
    router.replace("/auth/forgot-password");
  };

  // =====================================================
  // SUCCESS SCREEN
  // =====================================================

  if (resetCompleted) {
    return (
      <AuthScreen>
        <View style={styles.successContainer}>
          <View style={styles.successIconBox}>
            <Text style={styles.successIcon}>
              ✓
            </Text>
          </View>

          <Text style={styles.successTitle}>
            Password Reset Successful!
          </Text>

          <Text style={styles.successDescription}>
            Your BranchSuite Business password has
            been updated successfully.
          </Text>

          <Text style={styles.successDescription}>
            You can now sign in using your new password.
          </Text>

          <View style={styles.successButton}>
            <AppButton
              title="Go to Sign In"
              onPress={handleBackToLogin}
            />
          </View>
        </View>
      </AuthScreen>
    );
  }

  // =====================================================
  // RESET PASSWORD FORM
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
          🔐
        </Text>
      </View>

      {/* TITLE */}

      <Text style={styles.title}>
        Reset Password
      </Text>

      {/* SUBTITLE */}

      <Text style={styles.subtitle}>
        Enter the reset token sent to your email
        and choose a secure new password.
      </Text>

      {/* EMAIL INFORMATION */}

      {email ? (
        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>
            Reset requested for
          </Text>

          <Text style={styles.emailValue}>
            {email}
          </Text>
        </View>
      ) : null}

      {/* MAIN FORM CARD */}

      <View style={styles.card}>
        {/* RESET TOKEN */}

        <Text style={styles.inputLabel}>
          Password Reset Token
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.tokenInput,
            tokenError ? styles.inputError : null,
          ]}
          value={token}
          onChangeText={handleTokenChange}
          placeholder="Paste token from your email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="default"
          editable={!loading}
          maxLength={64}
          selectTextOnFocus
          accessibilityLabel="Password reset token"
        />

        {tokenError ? (
          <Text style={styles.fieldError}>
            {tokenError}
          </Text>
        ) : null}

        <Text style={styles.fieldHelper}>
          Copy the 64-character token from your
          BranchSuite Business password reset email.
        </Text>

        {/* NEW PASSWORD */}

        <Text style={styles.inputLabel}>
          New Password
        </Text>

        <View
          style={[
            styles.passwordContainer,
            passwordError ? styles.inputError : null,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={handlePasswordChange}
            placeholder="Enter new password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            maxLength={128}
            accessibilityLabel="New password"
          />

          <Pressable
            onPress={() =>
              setShowNewPassword((current) => !current)
            }
            style={styles.visibilityButton}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              showNewPassword
                ? "Hide new password"
                : "Show new password"
            }
          >
            <Text style={styles.visibilityText}>
              {showNewPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>

        {passwordError ? (
          <Text style={styles.fieldError}>
            {passwordError}
          </Text>
        ) : null}

        <Text style={styles.fieldHelper}>
          Use a password with at least 8 characters.
        </Text>

        {/* CONFIRM PASSWORD */}

        <Text style={styles.inputLabel}>
          Confirm New Password
        </Text>

        <View
          style={[
            styles.passwordContainer,
            confirmError ? styles.inputError : null,
          ]}
        >
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            placeholder="Re-enter new password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            maxLength={128}
            accessibilityLabel="Confirm new password"
          />

          <Pressable
            onPress={() =>
              setShowConfirmPassword((current) => !current)
            }
            style={styles.visibilityButton}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              showConfirmPassword
                ? "Hide confirmation password"
                : "Show confirmation password"
            }
          >
            <Text style={styles.visibilityText}>
              {showConfirmPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>

        {confirmError ? (
          <Text style={styles.fieldError}>
            {confirmError}
          </Text>
        ) : null}

        {/* API ERROR */}

        {apiError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {apiError}
            </Text>
          </View>
        ) : null}

        {/* LOADING */}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
            />

            <Text style={styles.loadingText}>
              Updating your password...
            </Text>
          </View>
        ) : null}

        {/* SUBMIT */}

        <AppButton
          title={
            loading
              ? "Please Wait..."
              : "Reset Password"
          }
          onPress={handleResetPassword}
        />

        {/* EXPIRATION INFORMATION */}

        <Text style={styles.expiryText}>
          Your reset token expires after 30 minutes
          and can only be used once.
        </Text>

        {/* REQUEST NEW TOKEN */}

        <Pressable
          onPress={handleRequestNewToken}
          style={styles.newTokenLink}
          disabled={loading}
        >
          <Text style={styles.newTokenText}>
            Token expired? Request a new one
          </Text>
        </Pressable>
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
    fontSize: 30,
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

  // =====================================================
  // EMAIL INFORMATION
  // =====================================================

  emailBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },

  emailLabel: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 5,
  },

  emailValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  // =====================================================
  // FORM CARD
  // =====================================================

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
  },

  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 9,
  },

  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },

  tokenInput: {
    fontSize: 13,
    letterSpacing: 0.2,
  },

  inputError: {
    borderColor: "#DC2626",
  },

  fieldError: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 6,
  },

  fieldHelper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
    marginBottom: 20,
  },

  // =====================================================
  // PASSWORD INPUT
  // =====================================================

  passwordContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },

  passwordInput: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },

  visibilityButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  visibilityText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  // =====================================================
  // API ERROR
  // =====================================================

  errorBox: {
    backgroundColor: "#FFF1F2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },

  errorText: {
    color: "#BE123C",
    fontSize: 13,
    lineHeight: 20,
  },

  // =====================================================
  // LOADING
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
  },

  // =====================================================
  // SUCCESS SCREEN
  // =====================================================

  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
  },

  successIconBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  successIcon: {
    color: "#15803D",
    fontSize: 40,
    fontWeight: "800",
  },

  successTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },

  successDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    marginBottom: 10,
  },

  successButton: {
    width: "100%",
    marginTop: 24,
  },

  // =====================================================
  // TOKEN EXPIRY
  // =====================================================

  expiryText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 18,
  },

  newTokenLink: {
    alignSelf: "center",
    paddingVertical: 12,
    marginTop: 10,
  },

  newTokenText: {
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
