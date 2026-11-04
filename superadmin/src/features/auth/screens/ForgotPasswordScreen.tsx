import React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors } from '../../../theme/tokens';
import { AppText, Button, FormError, FormText } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { authService } from '../../../core/auth/auth.service';
import { forgotSchema, type ForgotForm } from '../schemas/auth.schema';
import { AuthLayout } from '../components/AuthLayout';

/** Not in the APK. Required by the brief; submits fail visibly until the backend adds the endpoints. */
export function ForgotPasswordScreen() {
  const formError = useFormError();
  const form = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  const submit = form.handleSubmit(async ({ email }) => {
    formError.clear();
    try {
      await authService.requestPasswordReset(email);
    } catch (error) {
      formError.set(error);
    }
  });
  return (
    <AuthLayout>
      <AppText variant="h1" accessibilityRole="header">Reset your password</AppText>
      <AppText variant="body" color={colors.muted} style={{ marginTop: 6, marginBottom: 22 }}>Enter your admin email and we will send a reset code.</AppText>
      <FormText control={form.control} name="email" label="Admin email" required keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <FormError message={formError.message} />
      <Button label="Send reset code" full onPress={submit} loading={form.formState.isSubmitting} />
      <View style={{ alignItems: 'center', marginTop: 16, gap: 6 }}>
        <Link href="/reset-password" style={{ color: colors.primary, fontWeight: '700', paddingVertical: 6 }}>I have a code</Link>
        <Link href="/login" style={{ color: colors.primary, fontWeight: '700', paddingVertical: 6 }}>Back to sign in</Link>
      </View>
    </AuthLayout>
  );
}
