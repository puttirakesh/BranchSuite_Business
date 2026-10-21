import { api } from "../api/client";
import { call, fetchAll } from "./http";

export type RecordStatus = "ACTIVE" | "INACTIVE";
export type BusinessSubscriptionDto = {
  id: string; planId: string; billingCycle: string; status: string; createdAt: string; updatedAt: string;
};
export const subscriptionsApi = {
  current: () => call(api.get<BusinessSubscriptionDto | null>('/subscriptions/current')),
};
export type WorkspacePreferenceKey = 'profile' | 'workspace' | 'crm-lead-draft';
export const workspacePreferencesApi = {
  read: (companyId: string, key: WorkspacePreferenceKey) => call(api.get<{ key: WorkspacePreferenceKey; value: Record<string, unknown> } | null>('/workspace/preferences', { params: { companyId, key } })),
  save: (companyId: string, key: WorkspacePreferenceKey, value: Record<string, unknown>) => call(api.post('/workspace/preferences', { companyId, key, value })),
  remove: (companyId: string, key: WorkspacePreferenceKey) => call(api.delete('/workspace/preferences', { params: { companyId, key } })),
};
export type Named = { id: string; name: string };

export type CompanyDto = {
  employeeIdPrefix: string; employeeIdDigits: number; employeeIdNext: number;
  id: string;
  tenantId: string;
  name: string;
  status: RecordStatus;
};

export type BranchDto = {
  id: string;
  companyId: string;
  name: string;
  code: string;
  location: string;
  manager: string;
  managerUserId?: string | null;
  managerUser?: { id: string; name: string } | null;
  employees: number;
  status: RecordStatus;
  createdAt: string;
};

export type AvailableBranchDto = Pick<BranchDto, "id" | "companyId" | "name"> & {
  status: "ACTIVE";
};

export type UserDto = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roles: { role: Named }[];
  companyAccess: { company: Named }[];
  branchAccess: { branch: Named }[];
  createdAt: string;
};

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "EXITED";

export type EmployeeProfileDto = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  userId: string;
  employeeCode: string;
  department: string | null;
  designation: string | null;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
  status: EmploymentStatus;
  joiningDate: string;
  exitDate: string | null;
  workEmail: string | null;
  notes: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserDto["status"];
  };
  company: Named;
  branch: Named;
};

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type LeadDto = {
  id: string;
  companyId: string;
  branchId: string | null;
  name: string;
  contactPerson: string | null;
  source: string | null;
  estimatedValue: string | number | null;
  assignedEmployeeIds: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  stage: LeadStage;
  createdById: string;
  assignedToId: string | null;
  convertedCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadHistoryDto = {
  id: string;
  leadId: string;
  actorId: string;
  kind: string;
  note: string;
  createdAt: string;
};

export type CustomerDto = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type ActivityType = "CALL" | "MEETING" | "EMAIL" | "TASK" | "FOLLOW_UP";

export type ActivityStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export type ActivityDto = {
  id: string;
  companyId: string;
  branchId: string | null;
  leadId: string | null;
  customerId: string | null;
  title: string;
  description: string | null;
  type: ActivityType;
  status: ActivityStatus;
  scheduledAt: string;
  completedAt: string | null;
  createdById: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";

export type AttendanceDto = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  attendanceDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInTime12h?: string | null;
  checkOutTime12h?: string | null;
  status: AttendanceStatus;
  source: "SELF" | "MANUAL" | "SYSTEM";
  totalMinutes: number;
  notes: string | null;
  createdAt: string;
};

export type LeaveTypeDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  isPaid: boolean;
  annualAllowance: number;
  status: RecordStatus;
};

export type LeaveRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type LeaveRequestDto = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  leaveType?: {
    code: string;
    name: string;
    isPaid: boolean;
  };
};

export type LeaveBalanceDto = {
  id: string;
  tenantId: string;
  companyId: string;
  userId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  leaveType: {
    id: string;
    code: string;
    name: string;
    isPaid: boolean;
  };
};

/** Prisma Decimal values arrive as strings. */
export type Money = string;

export type SalaryComponentDto = {
  id: string;
  code: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amount: Money;
};

export type SalaryStructureDto = {
  id: string;
  name: string;
  currency: string;
  basicAmount: Money;
  status: RecordStatus;
  components: SalaryComponentDto[];
};

export type EmployeeSalaryDto = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  structureId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  basicOverride: Money | null;
  structure: SalaryStructureDto;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

export type PayrollStatus = "DRAFT" | "CALCULATED" | "APPROVED" | "PAID";

export type PayrollPeriodDto = {
  id: string;
  companyId: string;
  branchId: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  updatedAt: string;
  run: {
    id: string;
    status: PayrollStatus;
    grossTotal: Money;
    netTotal: Money;
  } | null;
};

export type PayrollEntryDto = {
  id: string;
  userId: string;
  currency: string;
  basicAmount: Money;
  grossAmount: Money;
  deductionsAmount: Money;
  netAmount: Money;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  components: {
    code: string;
    name: string;
    kind: "EARNING" | "DEDUCTION";
    amount: Money;
  }[];
  payment?: {
    id: string;
    paidAt: string;
    method: string;
  } | null;
};

export type PayrollRunDto = {
  id: string;
  status: PayrollStatus;
  approvedAt: string | null;
  calculatedAt: string | null;
  paidAt: string | null;
  grossTotal: Money;
  deductionsTotal: Money;
  netTotal: Money;
  period: PayrollPeriodDto;
  entries: PayrollEntryDto[];
};

export type PayrollIncentiveDto = { id: string; companyId: string; branchId: string; userId: string; year: number; month: number; amount: Money; description: string; createdAt: string; updatedAt: string };

const many = <T>(path: string, params: Record<string, unknown>) =>
  fetchAll<T>((page) =>
    call(
      api.get(path, {
        params: { ...params, page, limit: 100 },
      }),
    ),
  );

// COMPANIES

export const companiesApi = {
  updateEmployeeNumbering: (id: string, settings: { prefix: string; digits: number; nextNumber: number }) => call(api.patch<CompanyDto>(`/companies/${id}/employee-numbering`, settings)),
  list: () => call(api.get<CompanyDto[]>("/companies")),

  create: (name: string) => call(api.post<CompanyDto>("/companies", { name })),

  rename: (id: string, name: string) =>
    call(api.patch<CompanyDto>(`/companies/${id}`, { name })),
};

// BRANCHES

// Share overlapping reads only; completed results are never cached, so changes
// to branch access are checked again on the next request.
const availableBranchRequests = new Map<string, Promise<AvailableBranchDto[]>>();
function availableBranches(companyId: string): Promise<AvailableBranchDto[]> {
  const key = JSON.stringify([api.defaults.headers.common.Authorization ?? '', companyId]);
  const pending = availableBranchRequests.get(key);
  if (pending) return pending;
  const request = call(api.get<AvailableBranchDto[]>('/branches/available', { params: { companyId } }));
  availableBranchRequests.set(key, request);
  const clear = () => { if (availableBranchRequests.get(key) === request) availableBranchRequests.delete(key); };
  void request.then(clear, clear);
  return request;
}

export const branchesApi = {
  available: availableBranches,

  list: (companyId: string) =>
    call(api.get<BranchDto[]>("/branches", { params: { companyId } })),

  create: (
    companyId: string,
    name: string,
    details?: {
      code?: string;
      location?: string;
      manager?: string;
      managerUserId?: string | null;
    },
  ) => call(api.post<BranchDto>("/branches", { companyId, name, ...details })),

  update: (
    id: string,
    changes: Partial<Pick<BranchDto, "name" | "code" | "location" | "manager" | "managerUserId">>,
  ) => call(api.patch<BranchDto>(`/branches/${id}`, changes)),

  rename: (id: string, name: string) =>
    call(api.patch<BranchDto>(`/branches/${id}`, { name })),

  setStatus: (id: string, status: RecordStatus) =>
    call(api.patch<BranchDto>(`/branches/${id}/status`, { status })),
};

// USERS

export const usersApi = {
  setRole: (id: string, role: 'EMPLOYEE' | 'BRANCH_MANAGER' | 'SALES_MANAGER' | 'HR_MANAGER' | 'PAYROLL_MANAGER' | 'BUSINESS_ADMIN') =>
    call(api.post(`/users/${id}/roles`, { role })),
  list: () => call(api.get<UserDto[]>("/users")),

  create: (body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => call(api.post<UserDto>("/users", body)),

  update: (
    id: string,
    body: {
      name?: string;
      email?: string;
      phone?: string;
    },
  ) => call(api.patch<UserDto>(`/users/${id}`, body)),

  activate: (id: string) => call(api.patch<UserDto>(`/users/${id}/activate`)),

  deactivate: (id: string) =>
    call(api.patch<UserDto>(`/users/${id}/deactivate`)),

  grantAccess: (id: string, companyId: string, branchIds: string[]) =>
    call(
      api.post(`/users/${id}/access`, {
        companyId,
        branchIds,
      }),
    ),

  replaceAccess: (id: string, companyId: string, branchIds: string[]) =>
    call(api.put<UserDto>(`/users/${id}/access`, { companyId, branchIds })),

  revokeAccess: (id: string, companyId: string, branchIds: string[]) =>
    call(
      api.delete(`/users/${id}/access`, {
        data: { companyId, branchIds },
      }),
    ),
};

// EMPLOYEES

export type CreateEmployeeBody = {
  companyId: string;
  branchId: string;
  userId: string;
  employeeCode?: string;
  joiningDate: string;
  department?: string;
  designation?: string;
  workEmail?: string;
  notes?: string;
};

export const employeesApi = {
  list: (companyId: string) =>
    many<EmployeeProfileDto>("/employees", { companyId }),

  get: (id: string) => call(api.get<EmployeeProfileDto>(`/employees/${id}`)),
  update: (id: string, body: { branchId?: string; department?: string; designation?: string; workEmail?: string; joiningDate?: string; notes?: string }) => call(api.patch<EmployeeProfileDto>(`/employees/${id}`, body)),

  create: (body: CreateEmployeeBody) =>
    call(api.post<EmployeeProfileDto>("/employees", body)),

  setStatus: (id: string, status: EmploymentStatus, exitDate?: string) =>
    call(
      api.patch<EmployeeProfileDto>(`/employees/${id}/status`, {
        status,
        ...(exitDate ? { exitDate } : {}),
      }),
    ),
};

// CUSTOMERS — backend-backed CRM customer operations

export type CustomerWriteBody = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  branchId?: string | null;
};

export const customersApi = {
  list: (companyId: string) => many<CustomerDto>("/customers", { companyId }),
  get: (id: string) => call(api.get<CustomerDto>(`/customers/${id}`)),
  create: (body: CustomerWriteBody & { companyId: string }) =>
    call(api.post<CustomerDto>("/customers", body)),
  update: (id: string, body: CustomerWriteBody) =>
    call(api.patch<CustomerDto>(`/customers/${id}`, body)),
  setStatus: (id: string, status: RecordStatus) =>
    call(api.patch<CustomerDto>(`/customers/${id}/status`, { status })),
};

// CRM

export const leadsApi = {
  list: (companyId: string) => many<LeadDto>("/leads", { companyId }),
  history: (companyId: string) => call(api.get<LeadHistoryDto[]>("/leads/history", { params: { companyId } })),
  addHistory: (leadId: string, body: { id: string; kind: string; note: string }) =>
    call(api.post<LeadHistoryDto>(`/leads/${leadId}/history`, body)),

  create: (body: {
    companyId: string;
    branchId?: string;
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    assignedToId?: string | null;
    contactPerson?: string;
    source?: string;
    estimatedValue?: string;
    assignedEmployeeIds?: string[];
    stage?: LeadStage;
    followUpAt?: string;
    opportunity?: { title: string; amount?: string };
  }) => call(api.post<LeadDto>("/leads", body)),

  update: (
    id: string,
    body: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      branchId?: string | null;
      contactPerson?: string;
      source?: string;
      estimatedValue?: string;
      assignedEmployeeIds?: string[];
    },
  ) => call(api.patch<LeadDto>(`/leads/${id}`, body)),

  setStage: (id: string, stage: LeadStage) =>
    call(api.patch<LeadDto>(`/leads/${id}/stage`, { stage })),

  assign: (id: string, assignedToId: string | null) =>
    call(api.patch<LeadDto>(`/leads/${id}/assign`, { assignedToId })),

  convert: (id: string) =>
    call(
      api.post<{
        leadId: string;
        customer: CustomerDto;
      }>(`/leads/${id}/convert`),
    ),
};

export type CreateActivityBody = {
  companyId: string;
  branchId?: string;
  leadId?: string | null;
  title: string;
  description?: string;
  type: ActivityType;
  scheduledAt: string;
  assignedToId?: string | null;
};

export const activitiesApi = {
  list: (companyId: string) => many<ActivityDto>("/activities", { companyId }),

  create: (body: CreateActivityBody) =>
    call(api.post<ActivityDto>("/activities", body)),

  update: (
    id: string,
    body: {
      title?: string;
      description?: string | null;
      type?: ActivityType;
      scheduledAt?: string;
      assignedToId?: string | null;
    },
  ) => call(api.patch<ActivityDto>(`/activities/${id}`, body)),

  complete: (id: string) => call(api.patch(`/activities/${id}/complete`)),

  cancel: (id: string) => call(api.patch(`/activities/${id}/cancel`)),
};

// ATTENDANCE

export const attendanceApi = {
  list: (params: {
    companyId: string;
    branchId?: string;
    fromDate?: string;
    toDate?: string;
    userId?: string;
  }) => many<AttendanceDto>("/attendance", params),

  mine: (
    params: {
      fromDate?: string;
      toDate?: string;
    } = {},
  ) => many<AttendanceDto>("/attendance/my-history", params),

  checkIn: (companyId: string, branchId: string) =>
    call(
      api.post<AttendanceDto>("/attendance/check-in", { companyId, branchId }),
    ),

  checkOut: (companyId: string, branchId: string) =>
    call(
      api.post<AttendanceDto>("/attendance/check-out", { companyId, branchId }),
    ),

  mark: (body: {
    companyId: string;
    branchId: string;
    userId: string;
    attendanceDate: string;
    status: AttendanceStatus;
    notes?: string;
  }) => call(api.post<AttendanceDto>("/attendance/mark", body)),
};

export type AttendanceCorrectionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type AttendanceCorrectionDto = {
  id: string;
  companyId: string;
  branchId: string;
  userId: string;
  attendanceId: string;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  status: AttendanceCorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };
  attendance?: {
    attendanceDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: AttendanceStatus;
  };
};

export const attendanceCorrectionsApi = {
  create: (body: {
    attendanceId: string;
    requestedCheckInAt: string;
    requestedCheckOutAt: string;
    reason: string;
  }) =>
    call(api.post<AttendanceCorrectionDto>("/attendance/corrections", body)),

  mine: () =>
    call(api.get<AttendanceCorrectionDto[]>("/attendance/corrections/my")),

  list: (params: {
    companyId: string;
    branchId?: string;
    status?: AttendanceCorrectionStatus;
  }) => many<AttendanceCorrectionDto>("/attendance/corrections", params),

  approve: (id: string, note?: string) =>
    call(
      api.patch<AttendanceCorrectionDto>(
        `/attendance/corrections/${id}/approve`,
        { note },
      ),
    ),

  reject: (id: string, note: string) =>
    call(
      api.patch<AttendanceCorrectionDto>(
        `/attendance/corrections/${id}/reject`,
        { note },
      ),
    ),

  cancel: (id: string) =>
    call(
      api.patch<AttendanceCorrectionDto>(
        `/attendance/corrections/${id}/cancel`,
        {},
      ),
    ),
};
// LEAVE

export const leaveApi = {
  types: (companyId: string) =>
    call(api.get<LeaveTypeDto[]>("/leave/types", { params: { companyId } })),

  createType: (body: {
    companyId: string;
    code: string;
    name: string;
    isPaid?: boolean;
    annualAllowance?: number;
  }) => call(api.post<LeaveTypeDto>("/leave/types", body)),

  requests: (companyId: string) =>
    many<LeaveRequestDto>("/leave/requests", { companyId }),

  myRequests: (companyId: string, branchId: string) =>
    many<LeaveRequestDto>("/leave/requests/my", { companyId, branchId }),

  myBalances: (companyId: string, branchId: string, year?: number) =>
    call(
      api.get<LeaveBalanceDto[]>("/leave/balances/my", {
        params: {
          companyId,
          branchId,
          ...(year !== undefined ? { year } : {}),
        },
      }),
    ),

  balances: (params: {
    companyId: string;
    branchId: string;
    userId: string;
    year?: number;
  }) => call(api.get<LeaveBalanceDto[]>("/leave/balances", { params })),

  allocateBalance: (body: {
    companyId: string;
    branchId: string;
    userId: string;
    leaveTypeId: string;
    year: number;
    allocatedDays: number;
  }) => call(api.post<LeaveBalanceDto>("/leave/balances/allocate", body)),

  apply: (body: {
    companyId: string;
    branchId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => call(api.post<LeaveRequestDto>("/leave/requests", body)),

  approve: (id: string, note?: string) =>
    call(api.patch<LeaveRequestDto>(`/leave/requests/${id}/approve`, { note })),

  reject: (id: string, note?: string) =>
    call(api.patch<LeaveRequestDto>(`/leave/requests/${id}/reject`, { note })),

  cancel: (id: string) =>
    call(api.patch<LeaveRequestDto>(`/leave/requests/${id}/cancel`)),
};

// PAYROLL

export const payrollApi = {
  reviseSalary: (body: {
    companyId: string;
    branchId: string;
    userId: string;
    effectiveFrom: string;
    gross: string;
    deductions: string;
    reason: string;
  }) => call(api.post("/payroll/employee-salaries/revise", body)),
  createStructure: (body: {
    companyId: string;
    name: string;
    basicAmount: string;
    components: {
      code: string;
      name: string;
      kind: "EARNING" | "DEDUCTION";
      amount: string;
    }[];
  }) => call(api.post<SalaryStructureDto>("/payroll/salary-structures", body)),

  assignSalary: (body: {
    companyId: string;
    branchId: string;
    userId: string;
    structureId: string;
    effectiveFrom: string;
  }) => call(api.post<EmployeeSalaryDto>("/payroll/employee-salaries", body)),

  salaries: (companyId: string, branchId: string) =>
    call(
      api.get<EmployeeSalaryDto[]>("/payroll/employee-salaries", {
        params: { companyId, branchId },
      }),
    ),

  periods: (companyId: string, branchId: string) =>
    call(
      api.get<PayrollPeriodDto[]>("/payroll/periods", {
        params: { companyId, branchId },
      }),
    ),

  createPeriod: (body: {
    companyId: string;
    branchId: string;
    year: number;
    month: number;
  }) => call(api.post<PayrollPeriodDto>("/payroll/periods", body)),

  calculate: (periodId: string) =>
    call(api.post<PayrollRunDto>(`/payroll/periods/${periodId}/calculate`)),

  approve: (runId: string) =>
    call(api.post<PayrollRunDto>(`/payroll/runs/${runId}/approve`)),

  publish: (runId: string) =>
    call(api.post<PayrollRunDto>(`/payroll/runs/${runId}/publish`)),

  run: (runId: string) =>
    call(api.get<PayrollRunDto>(`/payroll/runs/${runId}`)),

  incentives: (companyId: string, branchId: string, year: number, month: number) =>
    call(api.get<PayrollIncentiveDto[]>('/payroll/incentives', { params: { companyId, branchId, year, month } })),

  saveIncentive: (body: { companyId: string; branchId: string; userId: string; year: number; month: number; amount: string; description: string }) =>
    call(api.post<PayrollIncentiveDto | null>('/payroll/incentives', body)),

  pay: (
    entryId: string,
    method: "BANK_TRANSFER" | "CASH" | "UPI" | "OTHER",
    reference?: string,
  ) => call(api.post(`/payroll/entries/${entryId}/pay`, { method, reference })),
};

export type AuditEventDto = {
  id: string;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  actorId: string;
  action: string;
  module: string;
  targetId: string;
  detail: string;
  changes: unknown;
  createdAt: string;
};

export const auditApi = {
  list: (params: {
    companyId?: string;
    branchId?: string;
    module?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }) =>
    call(
      api.get<{ items: AuditEventDto[]; nextCursor: string | null }>("/audit", {
        params,
      }),
    ),
};
