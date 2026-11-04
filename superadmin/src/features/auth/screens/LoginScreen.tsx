import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors, radius } from '../../../theme/tokens';
import { AppText, Avatar, Button, FieldShell, FormError, FormText, Icon, Note } from '../../../shared/components';
import { useAuth } from '../../../core/auth/AuthContext';
import { errorMessage } from '../../../core/api/api-error';
import { env } from '../../../core/config/env';
import { roleLabel } from '../../../core/permissions/roles';
import { previewDb } from '../../../core/data/previewStore';
import { PREVIEW_PASSWORD } from '../../../fixtures/previewData';
import { loginSchema, type LoginForm } from '../schemas/auth.schema';
import { AuthLayout } from '../components/AuthLayout';

/** APK admin `login` screen (workspace-ui.js `loginScreen`, admin mode). */
export function LoginScreen() {
  const { signIn, sessionExpired } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = env.dataMode === 'preview';
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthLayout>
      <AppText variant="h1" accessibilityRole="header">Admin sign in</AppText>
      <AppText variant="body" color={colors.muted} style={{ marginTop: 6, marginBottom: 22 }}>Your platform administration starts here.</AppText>
      {sessionExpired ? <Note tone="warning">Your session ended. Sign in again to continue.</Note> : null}
      {env.dataMode === 'unconfigured' ? (
        <Note tone="warning">No backend is connected, so sign-in is unavailable. Set EXPO_PUBLIC_API_URL, or EXPO_PUBLIC_PREVIEW_DATA=true for local UI review.</Note>
      ) : null}
      <FormText control={form.control} name="email" label="Admin email" required keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FieldShell label="Password" required error={fieldState.error?.message}>
            <View style={styles.passwordWrap}>
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                accessibilityLabel="Password"
                onSubmitEditing={() => void submit()}
                style={[styles.password, fieldState.error ? { borderColor: colors.error } : null]}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eye} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Icon name="eye" size={19} color={colors.ink} />
              </Pressable>
            </View>
          </FieldShell>
        )}
      />
      <FormError message={error} />
      <Button label="Sign in" trailingIcon="chevron" full onPress={submit} loading={form.formState.isSubmitting} disabled={env.dataMode === 'unconfigured'} />
      <View style={styles.links}>
        <Link href="/forgot-password" style={styles.link}>Forgot password?</Link>
      </View>
      {preview ? (
        <>
          <Text style={styles.help}>Preview accounts use <Text style={{ fontWeight: '700' }}>{PREVIEW_PASSWORD}</Text>.</Text>
          <Pressable style={styles.samples} onPress={() => setShowSamples((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showSamples }}>
            <Text style={styles.samplesText}>Try sample accounts</Text>
            <Icon name="down" size={15} color={colors.subtle} />
          </Pressable>
          {showSamples
            ? previewDb().accounts.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  style={styles.account}
                  onPress={() => {
                    form.setValue('email', a.email);
                    form.setValue('password', PREVIEW_PASSWORD);
                    void submit();
                  }}
                >
                  <Avatar name={a.name} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountRole}>{roleLabel[a.role]}</Text>
                    <Text style={styles.accountEmail}>{a.email}</Text>
                  </View>
                  <Icon name="chevron" size={15} color={colors.faint} />
                </Pressable>
              ))
            : null}
        </>
      ) : null}
      <View style={styles.foot}>
        <Icon name="lock" size={14} color={colors.subtle} />
        <Text style={styles.footText}>Dedicated Admin app</Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  passwordWrap: { justifyContent: 'center' },
  password: { minHeight: 50, backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: radius.md, paddingHorizontal: 14, paddingRight: 52, fontSize: 16, color: colors.ink },
  eye: { position: 'absolute', right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  links: { alignItems: 'center', marginTop: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13, paddingVertical: 8 },
  help: { textAlign: 'center', fontSize: 13, color: colors.muted, marginTop: 10 },
  samples: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8FAFD', borderRadius: radius.tile, padding: 16, marginTop: 18, minHeight: 52 },
  samplesText: { fontSize: 13, fontWeight: '700', color: colors.label },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.tile, padding: 12, marginTop: 10 },
  accountRole: { fontSize: 13, fontWeight: '700', color: colors.ink },
  accountEmail: { fontSize: 11, color: colors.subtle },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#EDF1F6', marginTop: 22, paddingTop: 18 },
  footText: { fontSize: 12, color: colors.muted },
});
