
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";
import { colors } from "../../src/shared/theme/colors";
import { plans } from "../../src/features/subscriptions/plans";

export default function SignupScreen() {
  const router = useRouter();
  const { plan, billing } = useLocalSearchParams<{
    plan?: string;
    billing?: string;
  }>();

  const selectedPlan = plans.find(
    (item) => item.id === plan
  ) ?? plans[0];

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (
      !businessName.trim() ||
      !ownerName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");

    Alert.alert(
      "UI Demo",
      "Your registration form is ready for backend integration.",
      [
        {
          text: "Go to Login",
          onPress: () => router.replace("/auth/login"),
        },
      ]
    );
  };

  return (
    <AuthScreen>
      <Pressable
        style={styles.back}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>‹ Back to plans</Text>
      </Pressable>

      <Text style={styles.title}>
        Create your business account
      </Text>

      <Text style={styles.subtitle}>
        Start your 14-day free trial with BranchSuite.
      </Text>

      <View style={styles.planBox}>
        <Text style={styles.planLabel}>SELECTED PLAN</Text>
        <Text style={styles.planName}>
          {selectedPlan.name}
        </Text>
        <Text style={styles.planBilling}>
          {billing === "annual" ? "Annual" : "Monthly"} billing
        </Text>
      </View>

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

        {!!error && (
          <Text style={styles.error}>{error}</Text>
        )}

        <AppButton
          title="Start Free Trial"
          onPress={handleSubmit}
        />
      </View>

      <Pressable
        onPress={() => router.replace("/auth/login")}
        style={styles.signIn}
      >
        <Text style={styles.signInText}>
          Already have an account? Sign in
        </Text>
      </Pressable>
    </AuthScreen>
  );
}

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
