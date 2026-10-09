import { Redirect, useLocalSearchParams } from 'expo-router';
import { CrmWorkspace } from '../../../../src/ui/CrmWorkspace';
export default function Page() {
  const { module } = useLocalSearchParams<{ module: string }>();
  return module === 'leads' ? <Redirect href="/admin/teamlead" /> : <CrmWorkspace mode="create" />;
}
