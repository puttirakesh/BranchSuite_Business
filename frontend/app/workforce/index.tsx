import BusinessDashboard from '../../src/features/workforce/BusinessDashboard';
import { SessionGate } from '../../src/features/workforce/ui';

export default function WorkforceHome() {
  return <SessionGate>{session => <BusinessDashboard key={`${session.userId}:${session.scope.branchId}:${session.accessToken}`} session={session} />}</SessionGate>;
}
