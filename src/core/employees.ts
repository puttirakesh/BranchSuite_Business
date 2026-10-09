import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmployeeProfile = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  branch: string;
  reportingManager: string;
  joiningDate: string;
};

export type Employee = EmployeeProfile & {
  id: string;
  createdAt: string;
  status?: 'active' | 'inactive';
  loginEnabled?: boolean;
};
const storageKey = 'branchsuite:employees:v1';
const profileFields = ['fullName', 'email', 'phone', 'jobTitle', 'department', 'branch', 'reportingManager', 'joiningDate'] as const;
let pendingWrite: Promise<void> = Promise.resolve();

export async function getEmployees(): Promise<Employee[]> {
  const stored = await AsyncStorage.getItem(storageKey);
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(item =>
    item !== null && typeof item === 'object' &&
    [...profileFields, 'id', 'createdAt'].every(field => typeof item[field] === 'string')
  )) {
    throw new Error('Saved employee records could not be read.');
  }
  return parsed as Employee[];
}

export function addEmployee(profile: EmployeeProfile): Promise<Employee> {
  // Serialize saves so overlapping submissions cannot overwrite one another.
  const operation = pendingWrite.then(async () => {
    const employees = await getEmployees();
    const email = profile.email.trim().toLowerCase();
    if (employees.some(employee => employee.email.toLowerCase() === email)) {
      throw new Error('An employee with this work email already exists.');
    }
    const employee: Employee = {
      fullName: profile.fullName.trim(), email, phone: profile.phone.trim(),
      jobTitle: profile.jobTitle.trim(), department: profile.department.trim(),
      branch: profile.branch.trim(), reportingManager: profile.reportingManager.trim(),
      joiningDate: profile.joiningDate.trim(),
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      status: 'active',
      loginEnabled: false,
    };
    await AsyncStorage.setItem(storageKey, JSON.stringify([employee, ...employees]));
    return employee;
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

function updateEmployeeSettings(id: string, changes: Partial<Pick<Employee, 'status' | 'loginEnabled'>>): Promise<Employee> {
  const operation = pendingWrite.then(async () => {
    const employees = await getEmployees();
    const index = employees.findIndex(employee => employee.id === id);
    if (index === -1) throw new Error('Employee could not be found.');
    const updated = { ...employees[index], ...changes };
    employees[index] = updated;
    await AsyncStorage.setItem(storageKey, JSON.stringify(employees));
    return updated;
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}

export function setEmployeeStatus(id: string, status: 'active' | 'inactive'): Promise<Employee> {
  return updateEmployeeSettings(id, { status });
}

export function setEmployeeLoginEnabled(id: string, loginEnabled: boolean): Promise<Employee> {
  return updateEmployeeSettings(id, { loginEnabled });
}
