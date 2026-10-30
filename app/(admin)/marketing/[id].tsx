import { useLocalSearchParams } from 'expo-router';
import { BranchSuiteScreen, useWorkspace } from '../../../src/core/providers/AppProviders';

export default function ProspectDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { db } = useWorkspace();
  const exists = id && (!db || db.saasLeads.some(record => record.id === id));
  return <BranchSuiteScreen route={exists ? 'platform-lead/' + id : 'platform-marketing'} />;
}

