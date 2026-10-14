import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TeamLeadDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/admin/crm/lead/[id]', params }} />;
}
