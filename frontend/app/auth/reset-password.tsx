<<<<<<< HEAD
import { useToastState } from '../../src/ui/useToastState';
import { formSpacing } from '../../src/shared/theme/formSpacing';
=======
import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AuthScreen from '../../src/shared/components/ui/AuthScreen';
import AppInput from '../../src/shared/components/ui/AppInput';
import AppButton from '../../src/shared/components/ui/AppButton';
import { colors } from '../../src/shared/theme/colors';
import { forgotPasswordApi, verifyOtpApi, resetPasswordApi } from '../../src/core/api/client';
>>>>>>> 207df035f7444e3ba9c39f9567b581a28e34fa47
import { toast } from '../../src/ui/toast-store';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'request' | 'verify' | 'password'>('request');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : err instanceof Error ? err.message : '';
      setError(Array.isArray(message) ? message.join(' ') : message || 'Unable to connect. Check that the backend is running.');
    } finally { setBusy(false); }
  };
<<<<<<< HEAD

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
      toast.success('Password reset successfully. You can now sign in.');
    } catch (err: unknown) {
      if (err instanceof InputValidationError) { setApiError(err.message); return; }
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
            <AppIcon symbol="✓" style={styles.successIcon} />
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
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.back}
        disabled={loading}
      >
        <AppIcon symbol="‹" size={16} color="#000" />
      </Pressable>

      {/* ICON */}

      <View style={styles.iconBox}>
        <AppIcon symbol="🔐" style={styles.icon} />
      </View>

      {/* TITLE */}

      <Text style={styles.title}>
        Reset Password
      </Text>

      {/* SUBTITLE */}

      

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



        <TextInput validation={{ required: true, pattern: /^[a-fA-F0-9]{64}$/, patternMessage: 'Enter the 64-character reset token from your email.' }} label={"Password Reset Token"}
          style={[
            styles.input,
            styles.tokenInput,
            tokenError ? styles.inputError : null,
          ]}
          value={token}
          onChangeText={handleTokenChange}
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



        <TextInput validation={{ kind: 'password', required: true, minLength: 8 }} label="New password" invalid={!!passwordError} trailingAccessory={<Pressable
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
          </Pressable>}

            value={newPassword}
            onChangeText={handlePasswordChange}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!loading}
            maxLength={128}
            accessibilityLabel="New password"
          />

        {passwordError ? (
          <Text style={styles.fieldError}>
            {passwordError}
          </Text>
        ) : null}

        <Text style={styles.fieldHelper}>
          Use a password with at least 8 characters.
        </Text>

        {/* CONFIRM PASSWORD */}



        <View style={styles.fieldGroup}>
          <TextInput validation={{ kind: 'password', required: true, minLength: 8, matches: newPassword }} label="Confirm new password" invalid={!!confirmError} trailingAccessory={<Pressable
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
            </Pressable>}

              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading}
              maxLength={128}
              accessibilityLabel="Confirm new password"
            />

          {confirmError ? (
            <Text style={styles.fieldError}>
              {confirmError}
            </Text>
          ) : null}
        </View>

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
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        onPress={handleBackToLogin}
        style={styles.returnLink}
        disabled={loading}
      >
        <AppIcon symbol="‹" size={16} color="#000" />
      </Pressable>
    </AuthScreen>
  );
=======
  const send = () => run(async () => {
    if (Date.now() < resendAt) throw new Error('Please wait 60 seconds before requesting another OTP.');
    const result = await forgotPasswordApi({ email: destination.trim().toLowerCase() });
    setChallengeId(result.challengeId); setOtp(''); setStage('verify'); setResendAt(Date.now() + 60000);
    toast.success(result.message);
  });
  return <AuthScreen>
    <Text style={styles.title}>{stage === 'password' ? 'Set new password' : 'Reset password'}</Text>
    <View style={styles.card} pointerEvents={busy ? 'none' : 'auto'}>
      {stage === 'request' ? <>
        <Text style={styles.fieldHelper}>We'll email a six-digit OTP to verify your account.</Text>
        <AppInput label="Registered email" value={destination} onChangeText={setDestination} keyboardType="email-address" autoCapitalize="none" maxLength={254} />
        <AppButton title={busy ? 'Sending...' : 'Send OTP'} onPress={send} />
      </> : stage === 'verify' ? <>
        <Text style={styles.fieldHelper}>Enter the six-digit OTP sent to {destination}. It expires in 10 minutes.</Text>
        <AppInput label="Verification OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" validation={{ required: true, pattern: /^[0-9]{6}$/, patternMessage: 'Enter the six-digit OTP.' }} />
        <AppButton title={busy ? 'Verifying...' : 'Verify OTP'} onPress={() => run(async () => { if (!/^[0-9]{6}$/.test(otp)) throw new Error('Enter the six-digit OTP.'); await verifyOtpApi(challengeId, otp); setStage('password'); })} />
        <Pressable onPress={send} style={styles.returnLink}><Text style={styles.returnText}>Resend OTP (after 60 seconds)</Text></Pressable>
        <Pressable onPress={() => { setStage('request'); setError(''); }}><Text style={styles.returnText}>Change email</Text></Pressable>
      </> : <>
        <AppInput label="New password" password value={newPassword} onChangeText={setNewPassword} autoComplete="new-password" maxLength={128} validation={{ kind: 'password', required: true, minLength: 8 }} />
        <AppInput label="Confirm new password" password value={confirmPassword} onChangeText={setConfirmPassword} maxLength={128} validation={{ kind: 'password', required: true, minLength: 8, matches: newPassword }} />
        <AppButton title={busy ? 'Saving...' : 'Save new password'} onPress={() => run(async () => {
          const result = await resetPasswordApi({ challengeId, otp, newPassword, confirmPassword });
          setOtp(''); setNewPassword(''); setConfirmPassword(''); toast.success(result.message); router.replace('/auth/login');
        })} />
        <Pressable style={styles.returnLink} onPress={() => { setOtp(''); setStage('request'); }}><Text style={styles.returnText}>Request a new OTP</Text></Pressable>
      </>}
      {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
    </View>
    <Pressable disabled={busy} style={styles.returnLink} onPress={() => router.replace('/auth/login')}><Text style={styles.returnText}>Back to sign in</Text></Pressable>
  </AuthScreen>;
>>>>>>> 207df035f7444e3ba9c39f9567b581a28e34fa47
}

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

  fieldGroup: { marginBottom: formSpacing.field },

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
