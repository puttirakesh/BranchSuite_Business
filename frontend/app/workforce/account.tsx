import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { availableScopes, LoginScope, logout, selectedSession } from '../../src/features/workforce/authApi';
import { asWorkforceError } from '../../src/features/workforce/api';
import { saveWorkforceSession } from '../../src/features/workforce/session';
import { Session } from '../../src/features/workforce/types';
import { Button, SessionGate, styles } from '../../src/features/workforce/ui';

export default function Account() { return <SessionGate>{session => <AccountContent key={`${session.userId}:${session.scope.branchId}:${session.accessToken}`} session={session} />}</SessionGate>; }
function AccountContent({ session }: { session: Session }) {
  const [scopes, setScopes] = useState<LoginScope[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(false);
  const load = async () => {
    setLoading(true); setError('');
    try { const result = await availableScopes(session); if (alive.current) setScopes(result); }
    catch (cause) { if (alive.current) { setScopes([]); setError(asWorkforceError(cause).message); } }
    finally { if (alive.current) setLoading(false); }
  };
  useFocusEffect(useCallback(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, []));
  const choose = async (scope: LoginScope) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await saveWorkforceSession(selectedSession(session, scope)); router.replace('/workforce'); }
    catch { if (alive.current) setError('Unable to switch branches. Please retry.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const signOut = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      // Require server revocation before reporting successful logout.
      try { await logout(session); } catch (cause) { if (asWorkforceError(cause).kind !== 'auth') throw cause; }
      await saveWorkforceSession(null); router.replace('/login');
    } catch (cause) { if (alive.current) setError(asWorkforceError(cause).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>Your branches</Text><Text style={styles.description}>Current branch: {session.scope.branchName}</Text>
    {loading && <Text style={styles.description}>Loading authorized branches…</Text>}
    {!loading && !error && !scopes.length && <Text style={styles.description}>No active branch memberships. Contact your administrator.</Text>}
    {scopes.map(scope => <Button key={scope.branchId} title={`${scope.companyName} · ${scope.branchName}`} secondary disabled={busy || loading} onPress={() => void choose(scope)} />)}
    {!!error && <><Text style={styles.error}>{error}</Text><Button title="Reload branches" secondary disabled={busy || loading} onPress={() => void load()} /></>}
    <Button title={busy ? 'Please wait…' : 'Sign out'} disabled={busy} onPress={() => void signOut()} />
  </ScrollView>;
}
