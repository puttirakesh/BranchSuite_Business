import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ErrorNotice, Field, styles } from '../src/components/ui';
import { resetPassword } from '../src/services/authService';
import { errorMessage } from '../src/services/api';
import { PasswordToggle } from '../src/components/PasswordToggle';

export default function ResetPasswordScreen() {
  const router = useRouter(); const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function save() {
    if (!token) { setError('Reset link is missing its token.'); return; }
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('Use at least 12 characters containing letters and numbers.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { await resetPassword(token, password); setDone(true); setPassword(''); setConfirm(''); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.page} contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}>
    <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: 16 }}>
      <Text style={styles.title}>Reset password</Text>
      <Card>{done ? <Text style={styles.muted}>Password updated. Sign in with your new password.</Text> : <>
        {!!error && <ErrorNotice message={error} />}
        <Field label="New password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" rightAccessory={<PasswordToggle visible={visible} disabled={busy} onToggle={() => setVisible((v) => !v)} />} />
        <Field label="Confirm password" value={confirm} onChangeText={setConfirm} editable={!busy} secureTextEntry={!visible} autoCapitalize="none" />
        <Button title="Save new password" busy={busy} onPress={() => { void save(); }} />
      </>}
      <Button variant="secondary" title="Back to sign in" onPress={() => router.replace('/login')} />
      </Card>
    </View>
  </ScrollView>;
}
