import { Redirect, useLocalSearchParams } from 'expo-router';
import { CrmWorkspace } from '../index';
export default function Page() {
  const { module, id, branch } = useLocalSearchParams<{ module: string; id: string; branch?: string }>();
  if (module === 'leads') return <Redirect href={{ pathname: '/admin/crm/lead/[id]', params: { id } }} />;
  if (module === 'customers') return <Redirect href={{ pathname: '/admin/crm/customers-live', params: { id, ...(branch ? { branch } : {}) } }} />;
  if (module === 'deals' || module === 'quotes') return <Redirect href={{ pathname: module === 'deals' ? '/admin/crm/deals-live' : '/admin/crm/quotes-live', params: { id, ...(branch ? { branch } : {}) } }} />;
  return <CrmWorkspace mode="detail" />;
}
