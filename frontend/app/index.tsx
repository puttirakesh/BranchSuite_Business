import { Redirect } from 'expo-router';
import { WorkforceSessionProvider, useWorkforceSession } from '../src/features/workforce/session';
import BusinessDashboard from '../src/features/workforce/BusinessDashboard';
import { State } from '../src/features/workforce/ui';

export default function HomeScreen() {
  return <WorkforceSessionProvider><BusinessHome /></WorkforceSessionProvider>;
}

function BusinessHome() {
  const { session, loading, error, reload } = useWorkforceSession();
  if (loading) return <State title="Loading workspace" busy />;
  if (error) return <State title="Session unavailable" message={error} retry={reload} />;
  return session ? <Redirect href="/workforce" /> : <BusinessDashboard />;
}
