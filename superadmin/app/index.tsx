import { Redirect } from 'expo-router';

/** Root URL: the admin group sends signed-out users on to /login. */
export default function Index() {
  return <Redirect href="/dashboard" />;
}
