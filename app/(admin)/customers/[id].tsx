import { useLocalSearchParams } from 'expo-router';
import { BranchSuiteScreen, useWorkspace } from '../../../src/core/providers/AppProviders';

export default function CustomerDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { db } = useWorkspace();
  const exists = id && (!db || db.tenants.some(record => record.id === id));
  return <BranchSuiteScreen route={exists ? 'platform-customer/' + id : 'platform-customers'} />;
}

