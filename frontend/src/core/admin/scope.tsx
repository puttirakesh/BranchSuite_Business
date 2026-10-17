import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { api, getSessionApi, type Membership } from "../api/client";
import { apiErrorMessage } from "./http";
import { branchesApi, type BranchDto } from "./api";

export type AdminScope = {
  tenantId: string;
  companyId: string;
  companyName: string;
  branchId: string | null;
  role: string;
  user: { id: string; name: string; email: string };
  /** Active branches this admin is assigned to (from the session). */
  branches: { id: string; name: string }[];
};

const ADMIN_ROLES = [
  "BUSINESS_OWNER",
  "BUSINESS_ADMIN",
  "BRANCH_MANAGER",
  "HR_MANAGER",
  "PAYROLL_MANAGER",
];

function pickMembership(memberships: Membership[]): Membership | undefined {
  const usable = memberships.filter((item) => item.branches.length > 0);
  return (
    usable.find((item) => ADMIN_ROLES.includes(item.role)) ??
    usable.find((item) => item.role !== "EMPLOYEE")
  );
}

let cached: {
  token: unknown;
  selection: string;
  promise: Promise<AdminScope>;
} | null = null;
let lastCompanyName = "";
let selection: { companyId: string; branchId: string | null } | null = null;
const STORE_KEY = "branchsuite_admin_workspace_selection";
if (Platform.OS === "web" && typeof window !== "undefined") {
  try {
    const saved = window.sessionStorage.getItem(STORE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed === "object" &&
        "companyId" in parsed &&
        typeof parsed.companyId === "string" &&
        "branchId" in parsed &&
        (parsed.branchId === null || typeof parsed.branchId === "string")
      ) {
        selection = { companyId: parsed.companyId, branchId: parsed.branchId };
      }
    }
  } catch {
    /* Storage may be unavailable in restricted browsers. */
  }
}
function persistSelection() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      if (selection)
        window.sessionStorage.setItem(STORE_KEY, JSON.stringify(selection));
      else window.sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* Selection still works in memory. */
    }
  }
}
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  cached = null;
  listeners.forEach((listener) => listener());
};
export function subscribeAdminSelection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getAdminSelectionVersion() {
  return version;
}
export function getSelectedBranchId() {
  return selection?.branchId ?? null;
}
export function getSelectedCompanyId() {
  return selection?.companyId ?? null;
}
export const currentCompanyName = () => lastCompanyName || "Your company";

/** A selection is always validated against current, server-supplied memberships. */
export function selectAdminWorkspace(
  companyId: string,
  branchId: string | null,
  memberships: Membership[],
) {
  const allowed = memberships.find(
    (m) => m.companyId === companyId && ADMIN_ROLES.includes(m.role),
  );
  if (!allowed) throw new Error("You do not have access to this company.");
  if (branchId && !allowed.branches.some((b) => b.id === branchId))
    throw new Error("You do not have access to this branch.");
  selection = { companyId, branchId };
  persistSelection();
  emit();
}
export function resetAdminWorkspace() {
  selection = null;
  persistSelection();
  emit();
}
function chooseMembership(memberships: Membership[]) {
  const allowed = memberships.filter(
    (m) => ADMIN_ROLES.includes(m.role) && m.branches.length > 0,
  );
  return (
    allowed.find((m) => m.companyId === selection?.companyId) ?? allowed[0]
  );
}
export function getAdminScope(): Promise<AdminScope> {
  const token = api.defaults.headers.common.Authorization;
  const key = `${selection?.companyId ?? ""}:${selection?.branchId ?? ""}`;
  if (cached && cached.token === token && cached.selection === key)
    return cached.promise;
  const promise = getSessionApi()
    .then(async (session) => {
      const membership = chooseMembership(session.memberships ?? []);
      if (!membership)
        throw new Error(
          "This account has no administrator access to a company branch.",
        );
      const branches = await branchesApi.available(membership.companyId);
      // Never trust a selection remaining from a previous user/session.
      const activeSelection = selection;
      const selected =
        activeSelection &&
        activeSelection.companyId === membership.companyId &&
        (activeSelection.branchId === null ||
          branches.some((b) => b.id === activeSelection.branchId))
          ? activeSelection.branchId
          : null;
      lastCompanyName = membership.companyName;
      return {
        tenantId: membership.tenantId,
        companyId: membership.companyId,
        companyName: membership.companyName,
        branchId: selected,
        role: membership.role,
        user: session.user,
        branches,
      };
    })
    .catch((error) => {
      throw new Error(apiErrorMessage(error, "Could not load your workspace."));
    });
  cached = { token, selection: key, promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}
export function invalidateAdminScope() {
  emit();
}
export async function getCompanyBranches(): Promise<BranchDto[]> {
  const scope = await getAdminScope();
  // Administrative metadata includes inactive branches so they can be managed.
  return branchesApi.list(scope.companyId);
}

/** Display names for records; staff do not need access to branch management. */
export async function getBranchDirectory(): Promise<{ id: string; name: string }[]> {
  const scope = await getAdminScope();
  return ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(scope.role)
    ? branchesApi.list(scope.companyId)
    : branchesApi.available(scope.companyId);
}

export function branchNameMap(
  branches: { id: string; name: string }[],
): Map<string, string> {
  return new Map(branches.map((branch) => [branch.id, branch.name]));
}

/** Resolves a branch name typed/selected in the UI to its id. Falls back to the only branch, if there is one. */
export function resolveBranchId(
  branches: { id: string; name: string }[],
  name: string | undefined,
): string | undefined {
  const wanted = name?.trim().toLowerCase();
  if (wanted) {
    const match = branches.find(
      (branch) => branch.name.trim().toLowerCase() === wanted,
    );
    if (match) return match.id;
  }
  return branches.length === 1 ? branches[0].id : undefined;
}

export function useAdminScope(enabled = true): AdminScope | null {
  const [scope, setScope] = useState<AdminScope | null>(null);
  useEffect(() => {
    if (!enabled) { setScope(null); return; }
    let active = true;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      getAdminScope()
        .then((value) => {
          if (active && current === request) setScope(value);
        })
        .catch(() => undefined);
    };
    refresh();
    const unsubscribe = subscribeAdminSelection(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);
  return scope;
}

/** Renders the signed-in company's name. */
export function CompanyName({ fallback = "" }: { fallback?: string }) {
  const scope = useAdminScope();
  return <>{scope?.companyName ?? fallback}</>;
}

/** Initials of the signed-in user (used in page header avatars). */
export function UserInitials() {
  const scope = useAdminScope();
  const initials = (scope?.user.name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
  return <>{initials}</>;
}
