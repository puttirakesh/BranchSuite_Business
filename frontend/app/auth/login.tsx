import { useToastState } from '../../src/ui/useToastState';
import { InputValidationError } from '../../src/shared/validation/request';

import React, { useEffect, useRef, useState } from "react";
import { withMinimumWait } from '../../src/core/auth/minimum-wait';
import { toast } from '../../src/ui/toast-store';

import {

  ActivityIndicator,
  AccessibilityInfo,
  Animated,
  Image,
  Platform,

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
import LoginWebFrame from '../../src/features/auth/LoginWebFrame';

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

  const web = Platform.OS === 'web';
  const styles = web ? webStyles : nativeStyles;

  const router = useRouter();

  const { signIn, loading } = useAuth();

  // =====================================================

  // STATE

  // =====================================================

  const [role, setRole] = useState<LoginRole>("business");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [loginError, setLoginError] = useToastState("", 'error');

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
    setLoginError('');

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
    setLoginError('');

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
    setLoginError('');

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

    if (!password.trim()) {

      nextErrors.password = "Enter your password.";

    }

    setErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);

  };

  // =====================================================

  // HANDLE LOGIN

  // =====================================================

  const handleLogin = async () => {

    if (isBusy || submittingRef.current) {

      return;

    }

    if (!validate()) {

      return;

    }

    submittingRef.current = true;
    setSubmitting(true);

    setLoginError("");

    try {

      const portal =

        role === "business" ? "staff" : "employee";

      // Authenticate through AuthProvider.

      //

      // AuthProvider handles the existing login

      // API and session persistence.

      await withMinimumWait(signIn(

        email.trim().toLowerCase(),

        password,

        portal

      ));

      if (!mounted.current) return;
      toast.success('Signed in successfully.');

      // Clear the password field.

      setPassword("");

      // Navigate to the appropriate portal.

      if (role === "business") {

        router.replace("/admin");

      } else {

        router.replace("/employee");

      }

    } catch (error: unknown) {
      if (error instanceof InputValidationError) { setLoginError(error.message); return; }

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

      setLoginError(message);

    } finally {

      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);

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

  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active) return;
      if (reduced) { entrance.setValue(1); return; }
      animation = Animated.timing(entrance, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' });
      animation.start();
    }).catch(() => { if (active) entrance.setValue(1); });
    return () => { active = false; animation?.stop(); };
  }, [entrance]);

  const brand = <View style={styles.brand}>
    <Image source={require('../../assets/icon.png')} accessibilityLabel="BranchSuite Business logo" resizeMode="contain" style={styles.logo} />
    <View style={styles.brandCopy}>
      <Text nativeID={web ? 'web-login-brand-name' : undefined} style={styles.brandName}>{web ? <>Branch<Text style={webStyles.brandAccent}>Suite</Text></> : 'BranchSuite'}</Text>
      <Text style={styles.brandCaption}>BUSINESS</Text>
    </View>
  </View>;
  const footer = <Text style={styles.footer}>One workspace. Every branch connected.</Text>;
  const card = (
      <Animated.View nativeID={web ? 'web-login-card' : undefined} style={[styles.card, {
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }]}>
        {!web && brand}
        <Text accessibilityRole="header" style={styles.heading}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your BranchSuite workspace.</Text>

        <View style={styles.tabs} accessibilityRole="tablist">
          {([
            ['business', 'Business & Staff'],
            ['employee', 'Employee'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} disabled={isBusy} onPress={() => handleRoleChange(value)}
              style={({ pressed }) => [styles.tab, role === value && styles.activeTab, pressed && !isBusy && styles.tabPressed]}
              accessibilityRole="tab" accessibilityState={{ selected: role === value, disabled: isBusy }}>
              <Text style={[styles.tabText, role === value && styles.activeTabText]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View nativeID={web ? 'web-login-fields' : undefined} style={styles.form}>
          <AppInput validation={{ required: true }} label="Work email" value={email} onChangeText={handleEmailChange}
            keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false}
            editable={!isBusy} error={errors.email} />
          <AppInput validation={{ kind: 'password', required: true, minLength: 1 }} label="Password"
            value={password} onChangeText={handlePasswordChange} password autoComplete="current-password"
            autoCorrect={false} editable={!isBusy} returnKeyType="go" onSubmitEditing={handleLogin} error={errors.password} />
        </View>
        <Pressable style={styles.forgot} disabled={isBusy} onPress={handleForgotPassword}
          accessibilityRole="button" accessibilityLabel="Forgot password" accessibilityState={{ disabled: isBusy }}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        {!!loginError && <Text style={styles.loginError} accessibilityRole="alert">{loginError}</Text>}
        <AppButton title={submitting ? 'Signing in...' : 'Sign In'} onPress={handleLogin}
          busy={submitting} disabled={isBusy} style={styles.signInButton} />
        <View style={styles.loadingContainer} accessibilityLiveRegion="polite">
          {submitting && <><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>Signing in securely...</Text></>}
        </View>
        {role === 'business' && <View nativeID={web ? 'web-login-plans' : undefined} style={styles.plansSection}>
          <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>New to BranchSuite?</Text><View style={styles.line} /></View>
          <AppButton title="Explore Subscription Plans" variant="outline" disabled={isBusy}
            onPress={handleExplorePlans} style={styles.plansButton} />
        </View>}
      </Animated.View>
  );
  return web ? (
    <LoginWebFrame brand={brand} footer={footer}>{card}</LoginWebFrame>
  ) : (
    <AuthScreen showBrand={false}>{card}{footer}</AuthScreen>
  );
}

const nativeStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 24,
    borderWidth: 1, borderColor: '#DFE6F2',
    boxShadow: '0 12px 40px rgba(27, 45, 74, 0.06)',
  },
  brand: { alignItems: 'center', marginBottom: 24 },
  brandCopy: { alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: 12 },
  brandName: { fontSize: 23, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  brandCaption: { fontSize: 9, fontWeight: '600', letterSpacing: 3, color: colors.muted, marginTop: 5 },
  heading: { fontSize: 28, fontWeight: '700', letterSpacing: -0.7, color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 8, marginBottom: 26, textAlign: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: '#F0F3F9', borderRadius: 10, padding: 4, marginBottom: 24 },
  tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 7, paddingHorizontal: 5, borderWidth: 1, borderColor: 'transparent' },
  activeTab: { backgroundColor: colors.surface, borderColor: '#DEE5F0' },
  tabPressed: { opacity: 0.7 },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  activeTabText: { color: colors.primary, fontWeight: '700' },
  form: { gap: 5 },
  forgot: { alignSelf: 'flex-end', minHeight: 44, paddingVertical: 10, marginBottom: 12, justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  signInButton: { borderRadius: 10, minHeight: 50 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 28, marginTop: 4 },
  loadingText: { color: colors.muted, fontSize: 11 },
  plansSection: { marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: '#E8EDF5' },
  or: { color: colors.muted, fontSize: 11 },
  plansButton: { borderRadius: 10, minHeight: 48, borderColor: '#D6E0EF' },
  footer: { textAlign: 'center', marginTop: 22, color: colors.muted, fontSize: 11, lineHeight: 18 },
  loginError: { color: colors.danger, backgroundColor: '#FFF4F5', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 19, marginBottom: 14 },
});

const webStyles = StyleSheet.create({
  ...nativeStyles,
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 36, paddingTop: 36, paddingBottom: 30,
    borderWidth: 1, borderColor: '#E5EAF2', width: '100%',
    boxShadow: '0 16px 48px rgba(16, 32, 64, 0.06), 0 2px 6px rgba(16, 32, 64, 0.02)',
  },
  brand: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 12 },
  brandCopy: { alignItems: 'flex-start', gap: 3 },
  logo: { width: 88, height: 88, borderRadius: 22 },
  brandName: { fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: -0.5, color: '#FFFFFF' },
  brandAccent: { color: '#F4A45C' },
  brandCaption: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 2.6, color: '#F4A45C' },
  heading: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, color: '#0F172A', textAlign: 'left' },
  subtitle: { color: '#475569', fontSize: 14, lineHeight: 22, marginTop: 6, marginBottom: 24, textAlign: 'left' },
  tabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 5, marginBottom: 24 },
  tab: { flex: 1, minHeight: 46, justifyContent: 'center', alignItems: 'center', borderRadius: 10, paddingHorizontal: 6, borderWidth: 1, borderColor: 'transparent' },
  activeTab: { backgroundColor: '#2563EB', borderColor: '#2563EB', boxShadow: '0 3px 8px rgba(37, 99, 235, 0.16)' },
  tabText: { color: '#475569', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  activeTabText: { color: '#FFFFFF', fontWeight: '600' },
  form: { gap: 18 },
  link: { color: '#1D4ED8', fontSize: 13, fontWeight: '600' },
  forgot: { alignSelf: 'flex-end', minHeight: 44, paddingVertical: 10, marginBottom: 12, justifyContent: 'center' },
  signInButton: { borderRadius: 12, minHeight: 52, backgroundColor: '#2563EB', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.16)' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 24, marginTop: 4 },
  loadingText: { color: '#475569', fontSize: 12 },
  plansSection: { marginTop: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  or: { color: '#64748B', fontSize: 12 },
  plansButton: { borderRadius: 12, minHeight: 48, borderColor: '#2563EB', backgroundColor: '#2563EB' },
  footer: { color: '#FFFFFF', fontSize: 28, lineHeight: 38, letterSpacing: -0.6, fontWeight: '500', maxWidth: 490 },
});
