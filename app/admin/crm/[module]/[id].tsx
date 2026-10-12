import { CrmWorkspace } from '../index';
import { useLocalSearchParams } from 'expo-router';
import { OpportunityDetails, QuotePreviewPage } from '../../../../src/ui/OpportunityDetails';
export default function Page() {
  const { module } = useLocalSearchParams<{ module: string }>();
  return module === 'deals' ? <OpportunityDetails /> : module === 'quotes' ? <QuotePreviewPage /> : <CrmWorkspace mode="detail" />;
}
