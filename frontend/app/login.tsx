import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { login, LoginResult, selectedSession } from '../src/features/workforce/authApi';
import { asWorkforceError } from '../src/features/workforce/api';
import { saveWorkforceSession } from '../src/features/workforce/session';
import { Button, styles } from '../src/features/workforce/ui';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<LoginResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const select = async (response: LoginResult, index: number) => {
    await saveWorkforceSession(selectedSession(response, response.scopes[index]));
    router.replace('/workforce');
  };
  const submit = async () => {
    if (lock.current) return;
    if (!email.trim() || !password) { setError('Enter your work email and password.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await login(email, password); setPassword('');
      if (!response.scopes.length) throw new Error('No branches');
      setResult(response);
      if (response.scopes.length === 1) await select(response, 0);
    } catch (cause) { setError(asWorkforceError(cause).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const choose = async (index: number) => {
    if (lock.current || !result) return;
    lock.current = true; setBusy(true); setError('');
    try { await select(result, index); }
    catch { setError('Unable to save your session. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>BranchSuite Business</Text><Text style={styles.heading}>{result ? 'Choose your branch' : 'Business sign in'}</Text>
      <Text style={styles.description}>{result ? 'Select where you want to manage your team.' : 'Sign in with your business account to access employee records.'}</Text>
      {result ? result.scopes.map((scope, index) => <Button key={scope.branchId} title={`${scope.companyName} · ${scope.branchName}`} disabled={busy} secondary onPress={() => void choose(index)} />) : <>
        <Text style={styles.fieldLabel}>Work email</Text><TextInput accessibilityLabel="Work email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} maxLength={254} />
        <Text style={styles.fieldLabel}>Password</Text><TextInput accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" editable={!busy} maxLength={256} />
        <Button title={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={() => void submit()} />
      </>}
      {!!error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
      <Button title="View Employees preview" secondary disabled={busy} onPress={() => router.push('/employees-preview')} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
