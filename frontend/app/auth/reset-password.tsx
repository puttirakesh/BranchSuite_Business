import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AuthScreen from '../../src/shared/components/ui/AuthScreen';
import AppInput from '../../src/shared/components/ui/AppInput';
import AppButton from '../../src/shared/components/ui/AppButton';
import { colors } from '../../src/shared/theme/colors';
import { forgotPasswordApi, verifyOtpApi, resetPasswordApi } from '../../src/core/api/client';
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
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : err instanceof Error
          ? err.message
          : '';
      setError(
        Array.isArray(message)
          ? message.join(' ')
          : message || 'Unable to connect. Check that the backend is running.',
      );
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      if (Date.now() < resendAt) {
        throw new Error('Please wait 60 seconds before requesting another OTP.');
      }

      const result = await forgotPasswordApi({
        email: destination.trim().toLowerCase(),
      });
      setChallengeId(result.challengeId);
      setOtp('');
      setStage('verify');
      setResendAt(Date.now() + 60000);
      toast.success(result.message);
    });

  return (
    <AuthScreen>
      <Text style={styles.title}>
        {stage === 'password' ? 'Set new password' : 'Reset password'}
      </Text>
      <View style={styles.card} pointerEvents={busy ? 'none' : 'auto'}>
        {stage === 'request' ? (
          <>
            <Text style={styles.helper}>
              We'll email a six-digit OTP to verify your account.
            </Text>
            <AppInput
              label="Registered email"
              value={destination}
              onChangeText={setDestination}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={254}
            />
            <AppButton
              title={busy ? 'Sending...' : 'Send OTP'}
              onPress={send}
              disabled={busy}
              busy={busy}
            />
          </>
        ) : stage === 'verify' ? (
          <>
            <Text style={styles.helper}>
              Enter the six-digit OTP sent to {destination}. It expires in 10
              minutes.
            </Text>
            <AppInput
              label="Verification OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="one-time-code"
              validation={{
                required: true,
                pattern: /^[0-9]{6}$/,
                patternMessage: 'Enter the six-digit OTP.',
              }}
            />
            <AppButton
              title={busy ? 'Verifying...' : 'Verify OTP'}
              onPress={() =>
                run(async () => {
                  if (!/^[0-9]{6}$/.test(otp)) {
                    throw new Error('Enter the six-digit OTP.');
                  }
                  await verifyOtpApi(challengeId, otp);
                  setStage('password');
                })
              }
              disabled={busy}
              busy={busy}
            />
            <Pressable onPress={send} style={styles.link} disabled={busy}>
              <Text style={styles.linkText}>Resend OTP (after 60 seconds)</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setStage('request');
                setError('');
              }}
              disabled={busy}
            >
              <Text style={styles.linkText}>Change email</Text>
            </Pressable>
          </>
        ) : (
          <>
            <AppInput
              label="New password"
              password
              value={newPassword}
              onChangeText={setNewPassword}
              autoComplete="new-password"
              maxLength={128}
              validation={{ kind: 'password', required: true, minLength: 8 }}
            />
            <AppInput
              label="Confirm new password"
              password
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              maxLength={128}
              validation={{
                kind: 'password',
                required: true,
                minLength: 8,
                matches: newPassword,
              }}
            />
            <AppButton
              title={busy ? 'Saving...' : 'Save new password'}
              onPress={() =>
                run(async () => {
                  const result = await resetPasswordApi({
                    challengeId,
                    otp,
                    newPassword,
                    confirmPassword,
                  });
                  setOtp('');
                  setNewPassword('');
                  setConfirmPassword('');
                  toast.success(result.message);
                  router.replace('/auth/login');
                })
              }
              disabled={busy}
              busy={busy}
            />
            <Pressable
              style={styles.link}
              onPress={() => {
                setOtp('');
                setStage('request');
              }}
              disabled={busy}
            >
              <Text style={styles.linkText}>Request a new OTP</Text>
            </Pressable>
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
      <Pressable
        disabled={busy}
        style={styles.link}
        onPress={() => router.replace('/auth/login')}
      >
        <Text style={styles.linkText}>Back to sign in</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 20,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 22,
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  link: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
});
