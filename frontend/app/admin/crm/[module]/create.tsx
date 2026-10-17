import { Redirect, useLocalSearchParams } from 'expo-router';
import { CrmWorkspace } from '../index';
export default function Page() {
  const { module, branch } = useLocalSearchParams<{ module: string; branch?: string }>();
  if (module === 'leads') return <Redirect href={{ pathname: '/admin/crm/lead-form', params: branch ? { branch } : {} }} />;
  if (module === 'customers') return <Redirect href={{ pathname: '/admin/crm/customers-live', params: { create: '1', ...(branch ? { branch } : {}) } }} />;
  if (module === 'deals' || module === 'quotes') return <Redirect href={{ pathname: module === 'deals' ? '/admin/crm/deals-live' : '/admin/crm/quotes-live', params: { create: '1', ...(branch ? { branch } : {}) } }} />;
  return <CrmWorkspace mode="create" />;
}
