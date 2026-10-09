import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TextInput } from 'react-native';
import { useSession } from '../src/store/session';
import { Button, Card, ErrorNotice, Field, styles } from '../src/components/ui';
import { errorMessage } from '../src/services/api';
import { colors } from '../src/constants/colors';
import { inputLimits, validateLogin } from '../src/utils/validation';
import type { LoginPortal } from '../src/services/demo';
import { PasswordToggle } from '../src/components/PasswordToggle';

export default function LoginScreen() {
  const { login, notice, portal: previousPortal } = useSession();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 480 || height < 600;
  const passwordInput = useRef<TextInput>(null);
  const [portal, setPortal] = useState<LoginPortal>(previousPortal);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validation = validateLogin(email, password);
  function selectLoginType(nextPortal: LoginPortal) {
    setPortal(nextPortal); setSubmitted(false); setTouched({}); setError(''); setShowPassword(false);
  }
  const fieldError = (field: string) => submitted || touched[field] ? validation.errors[field] : undefined;
  async function submit() {
    if (busy) return;
    setSubmitted(true); setError('');
    if (!validation.input) return;
    setBusy(true); setError('');
    try { await login(validation.input.email, validation.input.password, portal); }
    catch (err) { setError(axios.isAxiosError(err) && err.response?.status === 401 ? 'Email or password is incorrect.' : errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.page} keyboardVerticalOffset={insets.top} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1, justifyContent: height < 600 ? 'flex-start' : 'center', padding: compact ? 16 : 32 }}>
    <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', gap: compact ? 16 : 24 }}>
      <View style={styles.row}><View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#305CEB', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: '#FFF', fontWeight: '800', fontSize: 18 }}>BS</Text></View><Text style={{ color: colors.text, fontWeight: '800', fontSize: width < 360 ? 21 : 23, flexShrink: 1 }}>BranchSuite Business</Text></View>
      <View style={{ gap: 10 }}><Text style={[styles.title, { fontSize: width >= 800 ? 34 : 29 }]}>{portal === 'employee' ? 'Employee sign in' : 'Business sign in'}</Text><Text style={styles.muted}>Your company, branches and daily work in one place.</Text></View>
      <View accessibilityLabel="Login type" style={{ flexDirection: 'row', gap: 5, padding: 5, backgroundColor: '#E8EEFF', borderRadius: 14, maxWidth: 430 }}>{([['staff', 'Business & staff'], ['employee', 'Employee']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: portal === value, disabled: busy }} disabled={busy} onPress={() => selectLoginType(value)}
        style={{ flex: 1, minHeight: 48, padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: portal === value ? '#FFF' : 'transparent' }}><Text style={{ color: portal === value ? '#305CEB' : colors.secondaryText, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{label}</Text></Pressable>)}</View>
      <Card>
        <Text style={styles.heading}>Welcome back</Text>
        {notice && <Text style={styles.muted}>{notice}</Text>}{error && <ErrorNotice message={error} />}
        <Field label="Work email" accessibilityLabel="Email address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
          error={fieldError('email')} maxLength={inputLimits.email} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} style={{ fontSize: 16 }} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordInput.current?.focus()} />
        <Field label="Password" ref={passwordInput} value={password} onChangeText={(value) => { setPassword(value); setError(''); }} onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          error={fieldError('password')} maxLength={inputLimits.password} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showPassword} autoComplete="current-password" editable={!busy} style={{ fontSize: 16 }} returnKeyType="go" onSubmitEditing={() => { void submit(); }}
          rightAccessory={<PasswordToggle visible={showPassword} disabled={busy} onToggle={() => setShowPassword((current) => !current)} />} />
        <Button title="Sign in" busy={busy} onPressIn={() => { if (!validation.input) setSubmitted(true); }} onPress={() => { void submit(); }} />
      </Card>
    </View>
  </ScrollView></KeyboardAvoidingView>;
}
