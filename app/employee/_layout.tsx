import { EmployeeShell } from '../../src/features/employee/shell';
import { EmployeeWorkspaceProvider } from '../../src/features/employee/workspace';

export default function EmployeeLayout() {
  return (
    <EmployeeWorkspaceProvider>
      <EmployeeShell />
    </EmployeeWorkspaceProvider>
  );
}
