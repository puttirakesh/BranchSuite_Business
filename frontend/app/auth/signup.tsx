
import React, { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";
import { colors } from "../../src/shared/theme/colors";
import { plans } from "../../src/features/subscriptions/plans";

import {
  signupApi,
  type SignupBillingCycle,
  type SignupPlanId,
} from "../../src/core/api/client";

export default function SignupScreen() {
  const router = useRouter();

  // =====================================================
  // SELECTED SUBSCRIPTION PLAN
  // =====================================================

  const { plan, billing } = useLocalSearchParams<{
    plan?: string;
    billing?: string;
  }>();

  const selectedPlan =
    plans.find((item) => item.id === plan) ?? plans[0];

  const selectedPlanId: SignupPlanId =
    selectedPlan.id === "growth" ||
    selectedPlan.id === "scale"
      ? selectedPlan.id
      : "starter";

  const selectedBilling: SignupBillingCycle =
    billing === "annual" ? "annual" : "monthly";

  // =====================================================
  // FORM STATE
  // =====================================================

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent duplicate requests from rapid button taps.
  const submittingRef = useRef(false);

  // =====================================================
  // HANDLE SIGNUP
  // =====================================================

  const handleSubmit = async () => {
    if (submittingRef.current) {
      return;
    }

    const cleanBusinessName = businessName.trim();
    const cleanOwnerName = ownerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // ---------------------------------------------------
    // 1. REQUIRED FIELDS
    // ---------------------------------------------------

    if (
      !cleanBusinessName ||
      !cleanOwnerName ||
      !cleanEmail ||
      !cleanPhone ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    // ---------------------------------------------------
    // 2. FIELD LENGTH VALIDATION
    // ---------------------------------------------------

    if (
      cleanBusinessName.length > 150 ||
      cleanOwnerName.length > 150
    ) {
      setError(
        "Business and owner names must not exceed 150 characters."
      );
      return;
    }

    // ---------------------------------------------------
    // 3. EMAIL VALIDATION
    // ---------------------------------------------------

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254
    ) {
      setError("Enter a valid email address.");
      return;
    }

    // ---------------------------------------------------
    // 4. PHONE VALIDATION
    // ---------------------------------------------------

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    // ---------------------------------------------------
    // 5. PASSWORD VALIDATION
    // ---------------------------------------------------

    if (password.length < 8 || password.length > 128) {
      setError(
        "Password must contain between 8 and 128 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // ---------------------------------------------------
    // 6. SUBMIT REGISTRATION
    // ---------------------------------------------------

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const result = await signupApi({
        businessName: cleanBusinessName,
        ownerName: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        planId: selectedPlanId,
        billingCycle: selectedBilling,
      });

      // -------------------------------------------------
      // 7. SUCCESS
      // -------------------------------------------------

      // Clear passwords from component state.
      setPassword("");
      setConfirmPassword("");

      Alert.alert(
        "Account Created",
        `${result.message}\n\nYour ${selectedPlan.name} plan has been recorded and is pending activation.\n\nYou can now sign in to your business account.`,
        [
          {
            text: "Go to Login",
            onPress: () => {
              router.replace("/auth/login");
            },
          },
        ]
      );
    } catch (err: unknown) {
      // -------------------------------------------------
      // 8. API ERROR HANDLING
      // -------------------------------------------------

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        const responseData = err.response?.data as
          | {
              message?: string | string[];
              error?: string;
            }
          | undefined;

        const serverMessage = responseData?.message;

        const message = Array.isArray(serverMessage)
          ? serverMessage.join("\n")
          : serverMessage;

        if (status === 409) {
          setError(
            message ||
              "This email is already registered. Please sign in."
          );
        } else if (status === 400) {
          setError(
            message ||
              "Please check your registration details."
          );
        } else if (!err.response) {
          setError(
            "Unable to connect to the server. Check your internet connection and make sure the backend is running."
          );
        } else {
          setError(
            message ||
              "Registration failed. Please try again."
          );
        }
      } else {
        setError(
          "Something went wrong. Please try again."
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // SCREEN UI
  // =====================================================

  return (
    <AuthScreen>
      <Pressable
        style={styles.back}
        onPress={() => router.back()}
        disabled={isSubmitting}
      >
        <Text style={styles.backText}>
          ‹ Back to plans
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Create your business account
      </Text>

      <Text style={styles.subtitle}>
        Register your business with BranchSuite and
        choose a subscription plan.
      </Text>

      {/* =============================================== */}
      {/* SELECTED PLAN */}
      {/* =============================================== */}

      <View style={styles.planBox}>
        <Text style={styles.planLabel}>
          SELECTED PLAN
        </Text>

        <Text style={styles.planName}>
          {selectedPlan.name}
        </Text>

        <Text style={styles.planBilling}>
          {selectedBilling === "annual"
            ? "Annual"
            : "Monthly"}{" "}
          billing
        </Text>

        <Text style={styles.planNote}>
          Subscription activation is handled separately.
        </Text>
      </View>

      {/* =============================================== */}
      {/* REGISTRATION FORM */}
      {/* =============================================== */}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Business Information
        </Text>

        <AppInput
          label="Business name"
          placeholder="Enter business name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />

        <AppInput
          label="Owner / Admin name"
          placeholder="Enter full name"
          value={ownerName}
          onChangeText={setOwnerName}
          autoCapitalize="words"
        />

        <AppInput
          label="Work email"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
        />

        <AppInput
          label="Mobile number"
          placeholder="10-digit mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={styles.sectionTitle}>
          Account Security
        </Text>

        <AppInput
          label="Password"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          password
        />

        <AppInput
          label="Confirm password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          password
        />

        {/* ============================================= */}
        {/* ERROR MESSAGE */}
        {/* ============================================= */}

        {!!error && (
          <Text
            style={styles.error}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}

        {/* ============================================= */}
        {/* SUBMIT BUTTON */}
        {/* ============================================= */}

        <View
          pointerEvents={
            isSubmitting ? "none" : "auto"
          }
        >
          <AppButton
            title={
              isSubmitting
                ? "Creating Account..."
                : "Create Business Account"
            }
            onPress={handleSubmit}
          />
        </View>
      </View>

      {/* =============================================== */}
      {/* LOGIN NAVIGATION */}
      {/* =============================================== */}

      <Pressable
        onPress={() => router.replace("/auth/login")}
        style={styles.signIn}
        disabled={isSubmitting}
      >
        <Text style={styles.signInText}>
          Already have an account? Sign in
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
    marginBottom: 20,
    paddingVertical: 8,
  },

  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 20,
    marginBottom: 22,
  },

  planBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },

  planLabel: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "800",
    letterSpacing: 1,
  },

  planName: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
    marginTop: 7,
  },

  planBilling: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },

  planNote: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 18,
    marginTop: 4,
  },

  error: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 15,
    lineHeight: 18,
  },

  signIn: {
    alignSelf: "center",
    marginTop: 24,
    paddingVertical: 8,
  },

  signInText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
