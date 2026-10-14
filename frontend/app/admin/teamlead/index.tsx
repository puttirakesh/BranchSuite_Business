import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TeamLeadRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/admin/crm/lead-form', params }} />;
}
