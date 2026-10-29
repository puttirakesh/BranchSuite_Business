import { useToastState } from '../../src/ui/useToastState';
import { toast } from '../../src/ui/toast-store';
import { InputValidationError } from "../../src/shared/validation/request";
import { AppIcon } from "../../src/ui/AppIcon";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { BrandLogo } from "../../src/ui/BrandLogo";
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
  const { width } = useWindowDimensions();
  // Phones stack every field; tablets pair related fields; desktops add a plan and next-steps panel.
  const layout = width >= 1024 ? "desktop" : width >= 640 ? "tablet" : "phone";

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
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (!emailProof.sentAt) return;
    const tick = () => setResendIn(Math.max(0, Math.ceil((emailProof.sentAt + 60000 - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [emailProof.sentAt]);
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
      toast.info(result.message); // Not a final submission: success toasts reset touched fields.
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
    try { await verifyOtpApi(proof.id, proof.otp); setProof(value => ({ ...value, verified: true })); toast.info('OTP verified'); }
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

  const cleanEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const emailVerified = emailProof.verified && emailProof.destination === cleanEmail;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const steps = [
    { title: "Business", done: !!businessName.trim() && branchName.trim().length >= 2 },
    { title: "Owner", done: !!ownerName.trim() && emailValid && /^[0-9]{10}$/.test(phone.trim()) },
    { title: "Verify email", done: emailVerified },
    { title: "Security", done: password.length >= 8 && passwordsMatch },
  ];
  const completed = steps.filter((step) => step.done).length;
  const strength = passwordStrength(password);
  const planSummary = { name: selectedPlan.name, billing: selectedBilling === "annual" ? "Annual" : "Monthly" };

  const pair = (first: React.ReactNode, second: React.ReactNode) => (
    <View style={[styles.pair, layout !== "phone" && styles.pairWide]}>
      <View style={styles.pairItem}>{first}</View>
      <View style={styles.pairItem}>{second}</View>
    </View>
  );

  const section = (index: number, hint: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={[styles.stepBadge, steps[index].done && styles.stepBadgeDone]}>
          {steps[index].done ? <AppIcon name="check" size={14} color="#fff" /> : <Text style={styles.stepNumber}>{index + 1}</Text>}
        </View>
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{steps[index].title === "Owner" ? "Owner and contact" : steps[index].title}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>
      {children}
    </View>
  );

  const form = (
    <View style={[styles.card, layout === "phone" && styles.cardPhone]}>
      <View accessibilityLabel={`${completed} of ${steps.length} sections complete`} style={styles.progress}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(completed / steps.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{completed} of {steps.length} complete</Text>
      </View>

      {section(0, "This becomes your workspace and first branch.", pair(
        <AppInput
          validation={{ kind: 'name', startsWith: 'alphanumeric', required: true, maxLength: 150 }}
          label="Business name"
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />,
        <AppInput
          validation={{ kind: 'name', required: true, minLength: 2, maxLength: 150 }}
          label="Branch name"
          value={branchName}
          onChangeText={setBranchName}
          autoCapitalize="words"
          maxLength={150}
        />,
      ))}

      {section(1, "You will sign in with this email as the business owner.", <>
        <AppInput
          validation={{ kind: 'name', required: true, maxLength: 150 }}
          label="Owner / Admin name"
          value={ownerName}
          onChangeText={setOwnerName}
          autoCapitalize="words"
        />
        {pair(
          <AppInput
            validation={{ required: true }}
            label="Work email"
            value={email}
            onChangeText={value => { setEmail(value); setEmailProof(proof => ({ ...proof, verified: false })); }}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
          />,
          <AppInput
            validation={{ required: true }}
            label="Mobile number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={10}
          />,
        )}
        <Text style={styles.note}>10-digit mobile number, saved as contact information only.</Text>
      </>)}

      {section(2, "We send a six-digit code to your work email. It expires in 10 minutes.",
        <View pointerEvents={otpBusy || isSubmitting ? 'none' : 'auto'}>
          {emailVerified ? (
            <View style={styles.verified}>
              <AppIcon name="check-circle" size={18} color={colors.success} />
              <View style={styles.flex}>
                <Text style={styles.verifiedText}>Email verified</Text>
                <Text style={styles.note}>{emailProof.destination}. Changing the email asks you to verify again.</Text>
              </View>
            </View>
          ) : !emailProof.id ? (
            <>
              {!emailValid && <Text style={styles.note}>Enter your work email above, then send the code.</Text>}
              <AppButton title={otpBusy ? 'Please wait...' : 'Send email OTP'} onPress={requestCode} variant="outline" disabled={!emailValid} busy={otpBusy} />
            </>
          ) : (
            <>
              <Text style={styles.note}>Code sent to {emailProof.destination}.</Text>
              <View style={[styles.otpRow, layout !== "phone" && styles.pairWide]}>
                <View style={styles.pairItem}>
                  <AppInput label="Email OTP" value={emailProof.otp} onChangeText={otp => setEmailProof(value => ({ ...value, otp: otp.replace(/\D/g, '') }))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} />
                </View>
                <View style={layout !== "phone" ? styles.otpButtonWide : undefined}>
                  <AppButton title={otpBusy ? 'Please wait...' : 'Verify email OTP'} onPress={verifyCode} busy={otpBusy} disabled={emailProof.otp.length !== 6} />
                </View>
              </View>
              {emailProof.destination !== cleanEmail && <Text style={styles.warning}>The email changed after the code was sent. Send a new code.</Text>}
              <Pressable accessibilityRole="button" disabled={resendIn > 0 || otpBusy} onPress={requestCode} style={styles.inlineLink}>
                <Text style={[styles.linkText, (resendIn > 0 || otpBusy) && styles.linkMuted]}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </Pressable>
            </>
          )}
        </View>,
      )}

      {section(3, "Use at least 8 characters. A longer password with numbers and symbols is stronger.", <>
        {pair(
          <AppInput
            validation={{ kind: "password", required: true, minLength: 8 }}
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoComplete="new-password"
            password
          />,
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
            autoComplete="new-password"
            password
          />,
        )}
        {password.length > 0 && (
          <View accessibilityLabel={`Password strength: ${strength.label}`} style={styles.strength}>
            <View style={styles.strengthBars}>
              {[0, 1, 2, 3].map((index) => (
                <View key={index} style={[styles.strengthBar, index < strength.score && { backgroundColor: strength.color }]} />
              ))}
            </View>
            <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
          </View>
        )}
        {passwordsMatch && (
          <View style={styles.matchRow}>
            <AppIcon name="check" size={14} color={colors.success} />
            <Text style={styles.matchText}>Passwords match</Text>
          </View>
        )}
      </>)}

      {!!error && (
        <View style={styles.errorBox}>
          <AppIcon name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        </View>
      )}

      <View pointerEvents={isSubmitting ? "none" : "auto"}>
        <AppButton
          title={
            isSubmitting ? "Creating Account..." : "Create Business Account"
          }
          onPress={handleSubmit}
          busy={isSubmitting}
        />
      </View>
      <Text style={[styles.note, styles.center]}>Your subscription is activated separately after sign-up.</Text>
    </View>
  );

  const signInLink = (
    <Pressable
      onPress={() => router.replace("/auth/login")}
      accessibilityRole="button"
      style={styles.signIn}
      disabled={isSubmitting}
    >
      <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
    </Pressable>
  );

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to subscription plans"
      style={styles.back}
      onPress={handleBackToPlans}
      disabled={isSubmitting}
    >
      <AppIcon name="chevron-left" size={20} color={colors.text} />
      {layout !== "phone" && <Text style={styles.backText}>Plans</Text>}
    </Pressable>
  );

  if (layout === "desktop") {
    return (
      <AuthScreen wide showBrand={false}>
        <View style={styles.split}>
          <View style={styles.aside}>
            {back}
            <View style={styles.brandRow}>
              {Platform.OS === "web" && <BrandLogo size={44} />}
              <Text style={styles.brandName}>BranchSuite</Text>
            </View>
            <Text style={styles.heroTitle}>Create your business account</Text>
            <Text style={styles.heroText}>Set up your workspace in a few minutes. You can add more branches, employees and roles after signing in.</Text>
            <View style={styles.planCard}>
              <Text style={styles.planLabel}>SELECTED PLAN</Text>
              <View style={styles.planHeading}>
                <Text style={styles.planName}>{planSummary.name}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Change plan" onPress={handleBackToPlans} disabled={isSubmitting} style={styles.inlineLink}>
                  <Text style={styles.linkText}>Change</Text>
                </Pressable>
              </View>
              <Text style={styles.planBilling}>{planSummary.billing} billing · {selectedPlan.description}</Text>
              {selectedPlan.features.slice(0, 4).map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <AppIcon name="check" size={14} color={colors.primary} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.nextTitle}>What happens next</Text>
            {["Verify your work email with a one-time code", "Your workspace and first branch are created", "You are signed in to your dashboard"].map((item, index) => (
              <View key={item} style={styles.nextRow}>
                <Text style={styles.nextNumber}>{index + 1}</Text>
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={styles.formColumn}>
            {form}
            {signInLink}
          </View>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen wide={layout === "tablet"}>
      <View style={layout === "tablet" ? styles.tabletColumn : undefined}>
        <View style={styles.topBar}>
          {back}
          <View style={styles.planChip}>
            <Text numberOfLines={1} style={styles.planChipText}>{planSummary.name} · {planSummary.billing}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Change plan" onPress={handleBackToPlans} disabled={isSubmitting} style={styles.chipLink}>
              <Text style={styles.linkText}>Change</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>Create your business account</Text>
        <Text style={styles.subtitle}>Set up your workspace in a few minutes.</Text>
        {form}
        {signInLink}
      </View>
    </AuthScreen>
  );
}

// Guidance only: the API requires 8 to 128 characters.
function passwordStrength(value: string) {
  const score = [value.length >= 8, value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value) && /[^A-Za-z0-9]/.test(value)]
    .filter(Boolean).length;
  if (value.length < 8) return { score: 1, label: "Too short", color: colors.danger };
  return [
    { score: 1, label: "Weak", color: colors.danger },
    { score: 2, label: "Fair", color: colors.warning },
    { score: 3, label: "Good", color: colors.primary },
    { score: 4, label: "Strong", color: colors.success },
  ][Math.max(0, score - 1)];
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center", marginTop: 12, marginBottom: 0 },

  // Layout
  split: { flexDirection: "row", gap: 48, alignItems: "flex-start" },
  aside: { flex: 0.85, maxWidth: 420, paddingTop: 8 },
  formColumn: { flex: 1, maxWidth: 600 },
  tabletColumn: { width: "100%", maxWidth: 640, alignSelf: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },

  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 2,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  backText: { color: colors.text, fontSize: 14, fontWeight: "600" },

  // Headings
  title: { fontSize: 25, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20, marginBottom: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 28 },
  brandName: { fontSize: 22, fontWeight: "800", color: colors.text },
  heroTitle: { fontSize: 32, lineHeight: 40, fontWeight: "800", color: colors.text },
  heroText: { fontSize: 15, lineHeight: 24, color: colors.muted, marginTop: 12, marginBottom: 28 },

  // Plan
  planCard: { backgroundColor: colors.primaryLight, borderRadius: 16, padding: 20, marginBottom: 28, gap: 6 },
  planLabel: { fontSize: 11, color: colors.primary, fontWeight: "800", letterSpacing: 1 },
  planHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontSize: 22, fontWeight: "800", color: colors.text },
  planBilling: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  planChip: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 12, borderRadius: 999, backgroundColor: colors.primaryLight },
  planChipText: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  chipLink: { minHeight: 36, paddingHorizontal: 12, justifyContent: "center" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  nextTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: 12 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  nextNumber: { width: 26, height: 26, borderRadius: 13, textAlign: "center", lineHeight: 26, fontSize: 12, fontWeight: "800", color: colors.primary, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },

  // Form card
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: colors.border },
  cardPhone: { padding: 18, borderRadius: 16 },
  progress: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.primaryLight, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressText: { fontSize: 12, fontWeight: "600", color: colors.muted },

  section: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#EEF2F8" },
  sectionHeading: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primaryLight },
  stepBadgeDone: { backgroundColor: colors.success },
  stepNumber: { fontSize: 13, fontWeight: "800", color: colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  hint: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 2 },

  pair: { gap: 0 },
  pairWide: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  pairItem: { flex: 1, minWidth: 0 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  warning: { color: colors.warning, fontSize: 12, lineHeight: 18, marginBottom: 8 },

  // Email verification
  otpRow: { gap: 0 },
  otpButtonWide: { width: 190 },
  verified: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 12, backgroundColor: "#E7F5F2", marginBottom: 12 },
  verifiedText: { fontSize: 14, fontWeight: "700", color: colors.success, marginBottom: 2 },
  inlineLink: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  linkMuted: { color: colors.muted },

  // Password
  strength: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -6, marginBottom: 10 },
  strengthBars: { flex: 1, flexDirection: "row", gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#E3E9F3" },
  strengthText: { fontSize: 12, fontWeight: "700", minWidth: 64, textAlign: "right" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  matchText: { fontSize: 12, fontWeight: "600", color: colors.success },

  // Errors and footer
  errorBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12, backgroundColor: "#FBEDEF", marginTop: 4, marginBottom: 16 },
  error: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 19 },
  signIn: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginTop: 20, paddingVertical: 8 },
  signInText: { color: colors.muted, fontSize: 14 },
  signInLink: { color: colors.primary, fontWeight: "700" },
});
