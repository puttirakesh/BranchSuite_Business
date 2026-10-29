import { useToastState } from '../../src/ui/useToastState';
import { toast } from '../../src/ui/toast-store';
import { InputValidationError } from "../../src/shared/validation/request";
import { AppIcon } from "../../src/ui/AppIcon";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import axios from "axios";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";
import { colors } from "../../src/shared/theme/colors";
import { useAuth } from "../../src/core/auth/AuthProvider";
import { selectAdminWorkspace } from "../../src/core/admin/scope";
import { plans } from "../../src/features/subscriptions/plans";

import {
  signupApi,
  requestSignupOtpApi,
  verifyOtpApi,
  type SignupBillingCycle,
  type SignupPlanId,
} from "../../src/core/api/client";

export default function SignupScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  // =====================================================
  // SELECTED SUBSCRIPTION PLAN
  // =====================================================

  const { plan, billing } = useLocalSearchParams<{
    plan?: string;
    billing?: string;
  }>();

  const selectedPlan = plans.find((item) => item.id === plan) ?? plans[0];

  const selectedPlanId: SignupPlanId =
    selectedPlan.id === "growth" || selectedPlan.id === "scale"
      ? selectedPlan.id
      : "starter";

  const selectedBilling: SignupBillingCycle =
    billing === "annual" ? "annual" : "monthly";

  // =====================================================
  // FORM STATE
  // =====================================================

  const [businessName, setBusinessName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [emailProof, setEmailProof] = useState({ id: '', otp: '', verified: false, destination: '', sentAt: 0 });
  const [otpBusy, setOtpBusy] = useState(false);
  const requestCode = async () => {
    if (otpBusy || isSubmitting) return;
    const proof = emailProof;
    const setProof = setEmailProof;
    const destination = email.trim().toLowerCase();
    if (Date.now() - proof.sentAt < 60000) { setError('Please wait 60 seconds before requesting another OTP.'); return; }
    setOtpBusy(true);
    setError('');
    try {
      const result = await requestSignupOtpApi({ email: destination });
      setProof({ id: result.challengeId, otp: '', verified: false, destination, sentAt: Date.now() });
      toast.success(result.message);
    } catch (err) { setError(axios.isAxiosError(err) ? err.response?.data?.message || 'Unable to send OTP.' : err instanceof Error ? err.message : 'Unable to send OTP.'); }
    finally { setOtpBusy(false); }
  };
  const verifyCode = async () => {
    if (otpBusy || isSubmitting) return;
    const proof = emailProof;
    const setProof = setEmailProof;
    if (!/^[0-9]{6}$/.test(proof.otp)) { setError('Enter the six-digit OTP.'); return; }
    setOtpBusy(true);
    setError('');
    try { await verifyOtpApi(proof.id, proof.otp); setProof(value => ({ ...value, verified: true })); toast.success('OTP verified'); }
    catch { setError('Invalid or expired OTP. Request a new code if needed.'); }
    finally { setOtpBusy(false); }
  };

  const [error, setError] = useToastState("", 'error');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent duplicate requests from rapid button taps.
  const submittingRef = useRef(false);

  // =====================================================
  // HANDLE SIGNUP
  // =====================================================

  const handleSubmit = async () => {
    if (submittingRef.current || otpBusy) {
      return;
    }

    const cleanBusinessName = businessName.trim();
    const cleanBranchName = branchName.trim();
    const cleanOwnerName = ownerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // ---------------------------------------------------
    // 1. REQUIRED FIELDS
    // ---------------------------------------------------

    if (
      !cleanBusinessName ||
      !cleanBranchName ||
      !cleanOwnerName ||
      !cleanEmail ||
      !cleanPhone ||
      !password ||
      !confirmPassword
    ) {
      setError("Please complete all fields.", null);
      return;
    }

    // ---------------------------------------------------
    // 2. FIELD LENGTH VALIDATION
    // ---------------------------------------------------

    if (cleanBusinessName.length > 150 || cleanOwnerName.length > 150) {
      setError("Business and owner names must not exceed 150 characters.", null);
      return;
    }

    // The initial branch must have a meaningful, safe display name.
    if (cleanBranchName.length < 2 || cleanBranchName.length > 150) {
      setError("Branch name must contain 2 to 150 characters.", null);
      return;
    }

    if (/[\u0000-\u001F\u007F]/.test(cleanBranchName)) {
      setError("Branch name contains invalid characters.", null);
      return;
    }

    // ---------------------------------------------------
    // 3. EMAIL VALIDATION
    // ---------------------------------------------------

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254
    ) {
      setError("Enter a valid email address.", null);
      return;
    }

    // ---------------------------------------------------
    // 4. PHONE VALIDATION
    // ---------------------------------------------------

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      setError("Enter a valid 10-digit mobile number.", null);
      return;
    }

    // ---------------------------------------------------
    // 5. PASSWORD VALIDATION
    // ---------------------------------------------------

    if (!password.trim() || password.length < 8 || password.length > 128) {
      setError("Password must contain between 8 and 128 characters.", null);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.", null);
      return;
    }

    if (!emailProof.verified || emailProof.destination !== cleanEmail) {
      setError('Verify your email before creating your account.');
      return;
    }

    // ---------------------------------------------------
    // 6. SUBMIT REGISTRATION
    // ---------------------------------------------------

    submittingRef.current = true;
    setIsSubmitting(true);
    setError("");

    try {
      const registration = await signupApi({
        emailChallengeId: emailProof.id,
        emailOtp: emailProof.otp,
        businessName: cleanBusinessName,
        branchName: cleanBranchName,
        ownerName: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        password,
        planId: selectedPlanId,
        billingCycle: selectedBilling,
      });

      // Registration succeeded. Establish a real owner session before
      // entering the protected dashboard; never bypass the auth guard.
      let automaticLoginSucceeded = false;
      try {
        const session = await signIn(cleanEmail, password, "staff");
        selectAdminWorkspace(
          registration.business.companyId,
          registration.business.branchId,
          session.memberships,
        );
        automaticLoginSucceeded = true;
      } catch {
        // Registration is already saved. Allow a manual login instead of
        // reporting the registration itself as failed or retrying signup.
      }

      // Preserve valid field values while the signup screen remains mounted.
      // Resetting passwords here triggers required-field validation flashes.
      toast.success(automaticLoginSucceeded ? 'Registration Successful' : 'Registration Successful. Please sign in to continue.');

      // Keep the success toast visible for one second before redirecting.
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      router.replace(
        automaticLoginSucceeded ? "/admin/dashboard" : "/auth/login",
      );
    } catch (err: unknown) {
      if (err instanceof InputValidationError) {
        setError(err.message);
        return;
      }
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
          setError("This email is already registered. Please sign in.");
        } else if (status === 400) {
          setError(message || "Please check your registration details.");
        } else if (!err.response) {
          setError(
            "Unable to connect to the server. Check your internet connection and make sure the backend is running.",
          );
        } else {
          setError(message || "Registration failed. Please try again.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBackToPlans = () => {
    if (isSubmitting) return;
    // Direct route is reliable even when users opened signup via a link
    // or refreshed their browser (when router.back() has no plan history).
    router.replace({
      pathname: "/auth/plans",
      params: { billing: selectedBilling },
    });
  };

  // =====================================================
  // SCREEN UI
  // =====================================================

  return (
    <AuthScreen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to subscription plans"
        style={styles.back}
        onPress={handleBackToPlans}
        disabled={isSubmitting}
      >
        <AppIcon symbol="‹" size={16} color="#000" />
      </Pressable>

      <Text style={styles.title}>Create your business account</Text>

      {/* ======================================== */}
      {/* SELECTED PLAN */}
      {/* ======================================== */}

      <View style={styles.planBox}>
        <Text style={styles.planLabel}>SELECTED PLAN</Text>

        <Text style={styles.planName}>{selectedPlan.name}</Text>

        <Text style={styles.planBilling}>
          {selectedBilling === "annual" ? "Annual" : "Monthly"} billing
        </Text>

        <Text style={styles.planNote}>
          Subscription activation is handled separately.
        </Text>
      </View>

      {/* ======================================== */}
      {/* REGISTRATION FORM */}
      {/* ======================================== */}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Business Information</Text>

        <AppInput
          validation={{ kind: 'name', required: true, maxLength: 150 }}
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />

        <AppInput
          validation={{ kind: 'name', required: true, minLength: 2, maxLength: 150 }}
          label="Branch name"
          value={branchName}
          onChangeText={setBranchName}
          autoCapitalize="words"
          maxLength={150}
        />

        <AppInput
          validation={{ kind: 'name', required: true, maxLength: 150 }}
          label="Owner / Admin name"
          value={ownerName}
          onChangeText={setOwnerName}
          autoCapitalize="words"
        />

        <AppInput
          validation={{ required: true }}
          label="Work email"
          value={email}
          onChangeText={value => { setEmail(value); setEmailProof(proof => ({ ...proof, verified: false })); }}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
        />

        <AppInput
          validation={{ required: true }}
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
        />

        <Text style={styles.branchHint}>Your mobile number is saved as contact information and is not verified.</Text>
        <Text style={styles.sectionTitle}>Verify email</Text>
        <Text style={styles.branchHint}>Enter the six-digit OTP sent to your email. It expires in 10 minutes.</Text>
        <View pointerEvents={otpBusy || isSubmitting ? 'none' : 'auto'} style={{ marginBottom: 16 }}>
          {emailProof.verified ? <Text style={styles.branchHint}>Email verified</Text> : <>
            <AppButton title={otpBusy ? 'Please wait...' : 'Send email OTP'} onPress={requestCode} />
            {!!emailProof.id && <>
              <AppInput label="Email OTP" value={emailProof.otp} onChangeText={otp => setEmailProof(value => ({ ...value, otp }))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
              <AppButton title={otpBusy ? 'Please wait...' : 'Verify email OTP'} onPress={verifyCode} />
            </>}
          </>}
        </View>
        <Text style={styles.sectionTitle}>Account Security</Text>

        <AppInput
          validation={{ kind: "password", required: true, minLength: 8 }}
          label="Password"
          value={password}
          onChangeText={setPassword}
          password
        />

        <AppInput
          validation={{
            kind: "password",
            required: true,
            minLength: 8,
            matches: password,
          }}
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          password
        />

        {/* ====================================== */}
        {/* ERROR MESSAGE */}
        {/* ====================================== */}

        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        {/* ====================================== */}
        {/* SUBMIT BUTTON */}
        {/* ====================================== */}

        <View pointerEvents={isSubmitting ? "none" : "auto"}>
          <AppButton
            title={
              isSubmitting ? "Creating Account..." : "Create Business Account"
            }
            onPress={handleSubmit}
          />
        </View>
      </View>

      {/* ======================================== */}
      {/* LOGIN NAVIGATION */}
      {/* ======================================== */}

      <Pressable
        onPress={() => router.replace("/auth/login")}
        accessibilityRole="button"
        style={styles.signIn}
        disabled={isSubmitting}
      >
        <Text style={styles.signInText}>Already have an account? Sign in</Text>
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
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

  branchHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 18,
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
    minHeight: 44,
    justifyContent: "center",
    marginTop: 24,
    paddingVertical: 8,
  },

  signInText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
