import React, { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors } from '../../../theme/tokens';
import { AppText, Button, FormError, FormText, Note } from '../../../shared/components';
import { useFormError } from '../../../shared/hooks/useMutationForm';
import { authService } from '../../../core/auth/auth.service';
import { resetSchema, type ResetForm } from '../schemas/auth.schema';
import { AuthLayout } from '../components/AuthLayout';

/** Not in the APK. Completes password recovery once the backend provides the endpoint. */
export function ResetPasswordScreen() {
  const formError = useFormError();
  const [done] = useState(false);
  const form = useForm<ResetForm>({ resolver: zodResolver(resetSchema), defaultValues: { code: '', password: '', confirm: '' } });
  const submit = form.handleSubmit(async ({ code, password }) => {
    formError.clear();
    try {
      await authService.resetPassword(code, password);
    } catch (error) {
      formError.set(error);
    }
  });
  return (
    <AuthLayout>
      <AppText variant="h1" accessibilityRole="header">Choose a new password</AppText>
      <AppText variant="body" color={colors.muted} style={{ marginTop: 6, marginBottom: 22 }}>Use the code from your email. Passwords need 8+ characters with a letter and a number.</AppText>
      {done ? <Note tone="success">Password updated. Sign in with your new password.</Note> : null}
      <FormText control={form.control} name="code" label="Reset code" required autoCapitalize="none" />
      <FormText control={form.control} name="password" label="New password" required secureTextEntry autoComplete="new-password" />
      <FormText control={form.control} name="confirm" label="Confirm new password" required secureTextEntry autoComplete="new-password" />
      <FormError message={formError.message} />
      <Button label="Update password" full onPress={submit} loading={form.formState.isSubmitting} />
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <Link href="/login" style={{ color: colors.primary, fontWeight: '700', paddingVertical: 6 }}>Back to sign in</Link>
      </View>
    </AuthLayout>
  );
}
