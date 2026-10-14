import { Redirect, useLocalSearchParams } from 'expo-router';
import { CrmWorkspace } from '../index';
import { NewQuotePage } from '../../../../src/ui/OpportunityDetails';
export default function Page() {
  const { module } = useLocalSearchParams<{ module: string }>();
  return module === 'leads' ? <Redirect href="/admin/crm/lead-form" /> : module === 'quotes' ? <NewQuotePage /> : <CrmWorkspace mode="create" />;
}
