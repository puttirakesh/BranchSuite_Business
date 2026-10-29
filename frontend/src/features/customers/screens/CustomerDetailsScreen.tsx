import { BranchSuiteScreen } from '../../../core/providers/AppProviders';
import { useLocalSearchParams } from 'expo-router';
export default function Screen() {
 const params = useLocalSearchParams<{ id: string | string[] }>(); const id = Array.isArray(params.id) ? params.id[0] : params.id;
 return <BranchSuiteScreen route={'platform-customer/' + (id || '')} />;
}
