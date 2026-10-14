/**
 * Drop-in replacement for AsyncStorage used by the admin pages.
 *
 * The admin UI was written against AsyncStorage keys (one JSON array per feature).
 * Keys listed in `routes` are now served by the backend API through repositories that
 * keep the exact JSON shape the pages expect; every other key (drafts, UI preferences,
 * features with no backend yet) still lives on the device.
 *
 * Migrating a page off this adapter later is straightforward: call the repository
 * functions (readLeads, readTasks, …) directly instead of getItem/setItem.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readLeads, saveLeads, leadsKey, type Lead } from '../leads';
import { readPayroll, readRuns, saveRuns, type PayrollRun } from '../payroll';
import { readTasks, saveTasks, type AdminTask } from './tasks';
import { readMyAttendance, readRequests, readTeamAttendance, saveRequests, type AdminRequest } from './attendance';
import {
  readAccessUsers, readBranches, readWorkspaceSettings, saveAccessUsers, saveBranches, saveWorkspaceSettings,
  type AccessUser, type AdminBranch, type WorkspaceSettings,
} from './organisation';

type Route = { read: () => Promise<unknown>; write?: (value: unknown) => Promise<void> };

const readOnly = (what: string) => async () => {
  throw new Error(`${what} is read from the server and cannot be edited here.`);
};

export const API_BACKED_KEYS = {
  leads: leadsKey,
  tasks: 'branchsuite:tasks:v1',
  requests: 'branchsuite:my-attendance-requests:v1',
  myAttendance: 'branchsuite:my-attendance:v1',
  teamAttendance: 'branchsuite:team-attendance:v1',
  branches: 'branchsuite:branches:v1',
  payroll: 'branchsuite:payroll:v1',
  payrollRuns: 'branchsuite:payroll-runs:v1',
  access: 'branchsuite:demo-access:v1',
  workspace: 'branchsuite:workspace-settings:v1',
} as const;

const routes: Record<string, Route> = {
  [API_BACKED_KEYS.leads]: { read: readLeads, write: value => saveLeads(value as Lead[]) },
  [API_BACKED_KEYS.tasks]: { read: readTasks, write: value => saveTasks(value as AdminTask[]) },
  [API_BACKED_KEYS.requests]: { read: readRequests, write: value => saveRequests(value as AdminRequest[]) },
  [API_BACKED_KEYS.myAttendance]: { read: readMyAttendance, write: readOnly('Attendance') },
  [API_BACKED_KEYS.teamAttendance]: { read: readTeamAttendance, write: readOnly('Attendance') },
  [API_BACKED_KEYS.branches]: { read: readBranches, write: value => saveBranches(value as AdminBranch[]) },
  [API_BACKED_KEYS.payroll]: { read: readPayroll, write: readOnly('Payroll') },
  [API_BACKED_KEYS.payrollRuns]: { read: readRuns, write: value => saveRuns(value as PayrollRun[]) },
  [API_BACKED_KEYS.access]: { read: readAccessUsers, write: value => saveAccessUsers(value as AccessUser[]) },
  [API_BACKED_KEYS.workspace]: { read: readWorkspaceSettings, write: value => saveWorkspaceSettings(value as WorkspaceSettings) },
};

const AdminStorage = {
  async getItem(key: string): Promise<string | null> {
    const route = routes[key];
    if (!route) return AsyncStorage.getItem(key);
    try {
      return JSON.stringify(await route.read());
    } catch (error) {
      // Pages often show a generic message; keep the real cause visible in the console.
      console.warn(`[admin api] loading ${key} failed:`, error);
      throw error;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const route = routes[key];
    if (!route) return AsyncStorage.setItem(key, value);
    await route.write!(JSON.parse(value));
  },
  async removeItem(key: string): Promise<void> {
    if (routes[key]) return; // server data is never deleted through the storage adapter
    return AsyncStorage.removeItem(key);
  },
};

export default AdminStorage;
