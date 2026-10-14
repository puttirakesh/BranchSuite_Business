import React, { useEffect, useState } from 'react';
import { api, getSessionApi, type Membership } from '../api/client';
import { apiErrorMessage } from './http';
import { branchesApi, type BranchDto } from './api';

export type AdminScope = {
  tenantId: string;
  companyId: string;
  companyName: string;
  role: string;
  user: { id: string; name: string; email: string };
  /** Active branches this admin is assigned to (from the session). */
  branches: { id: string; name: string }[];
};

const ADMIN_ROLES = ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'];

function pickMembership(memberships: Membership[]): Membership | undefined {
  const usable = memberships.filter(item => item.branches.length > 0);
  return usable.find(item => ADMIN_ROLES.includes(item.role)) ?? usable.find(item => item.role !== 'EMPLOYEE');
}

let cached: { token: unknown; promise: Promise<AdminScope> } | null = null;
let lastCompanyName = '';

/** Last loaded company name, for plain-string contexts such as HTML/PDF exports. */
export const currentCompanyName = () => lastCompanyName || 'Your company';

/**
 * The company and branches the admin pages operate on. Cached per access token,
 * so signing in as someone else automatically refreshes it.
 * When an admin has several companies, the first one is used.
 */
export function getAdminScope(): Promise<AdminScope> {
  const token = api.defaults.headers.common.Authorization;
  if (cached && cached.token === token) return cached.promise;
  const promise = getSessionApi()
    .then(session => {
      const membership = pickMembership(session.memberships ?? []);
      if (!membership) throw new Error('This account has no administrator access to a company branch.');
      lastCompanyName = membership.companyName;
      return {
        tenantId: membership.tenantId,
        companyId: membership.companyId,
        companyName: membership.companyName,
        role: membership.role,
        user: session.user,
        branches: membership.branches,
      };
    })
    .catch(error => { throw new Error(apiErrorMessage(error, 'Could not load your workspace.')); });
  cached = { token, promise };
  promise.catch(() => { if (cached?.promise === promise) cached = null; });
  return promise;
}

/** Call after changing companies/branches so names and access are re-read. */
export function invalidateAdminScope() {
  cached = null;
}

/** All branches of the admin's company, including inactive ones. */
export async function getCompanyBranches(): Promise<BranchDto[]> {
  const scope = await getAdminScope();
  return branchesApi.list(scope.companyId);
}

export function branchNameMap(branches: { id: string; name: string }[]): Map<string, string> {
  return new Map(branches.map(branch => [branch.id, branch.name]));
}

/** Resolves a branch name typed/selected in the UI to its id. Falls back to the only branch, if there is one. */
export function resolveBranchId(branches: { id: string; name: string }[], name: string | undefined): string | undefined {
  const wanted = name?.trim().toLowerCase();
  if (wanted) {
    const match = branches.find(branch => branch.name.trim().toLowerCase() === wanted);
    if (match) return match.id;
  }
  return branches.length === 1 ? branches[0].id : undefined;
}

export function useAdminScope(): AdminScope | null {
  const [scope, setScope] = useState<AdminScope | null>(null);
  useEffect(() => {
    let active = true;
    getAdminScope().then(value => { if (active) setScope(value); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return scope;
}

/** Renders the signed-in company's name (used in page headers instead of a hardcoded demo name). */
export function CompanyName({ fallback = '' }: { fallback?: string }) {
  const scope = useAdminScope();
  return <>{scope?.companyName ?? fallback}</>;
}

/** Initials of the signed-in user (used in page header avatars). */
export function UserInitials() {
  const scope = useAdminScope();
  const initials = (scope?.user.name ?? '').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
  return <>{initials}</>;
}
