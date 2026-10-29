
import { api } from "../../core/api/client";

export interface EmployeeProfile {
  reportingManagerId?: string | null;
  reportingManager?: { id: string; name: string } | null;
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  userId: string;

  employeeCode: string;
  department: string | null;
  designation: string | null;
  employmentType: string;
  workEmail: string | null;
  joiningDate: string;
  exitDate: string | null;
  status: string;
  notes: string | null;

  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
  };

  company: {
    id: string;
    name: string;
  };

  branch: {
    id: string;
    name: string;
    manager: string;
  };
}

export async function getEmployeeProfiles(): Promise<
  EmployeeProfile[]
> {
  const response = await api.get<EmployeeProfile[]>(
    "/employees/me"
  );

  return response.data;
}
