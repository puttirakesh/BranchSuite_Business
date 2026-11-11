
export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
  /** Hard limits enforced by the backend (mirrors backend subscription-catalog.ts). */
  limits: { employees: number; branches: number; companies: number; staffUsers: number };
};

/** Resolves the plan and billing cycle from route params; never silently defaults. */
export function resolveSelection(
  plan: string | undefined,
  billing: string | undefined,
): { plan: SubscriptionPlan; billing: BillingCycle } | null {
  const selected = plans.find((item) => item.id === plan);
  if (!selected) return null;
  if (billing !== undefined && billing !== "monthly" && billing !== "annual") return null;
  return { plan: selected, billing: billing ?? "monthly" };
}

export function formatPlanPrice(plan: SubscriptionPlan, billing: BillingCycle): string {
  const amount = billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  return `₹${new Intl.NumberFormat("en-IN").format(amount)} / ${billing === "annual" ? "year" : "month"}`;
}

export function describeLimits(limits: SubscriptionPlan["limits"]): string[] {
  return [
    `Up to ${limits.employees.toLocaleString("en-IN")} employees`,
    `${limits.branches} ${limits.branches === 1 ? "branch" : "branches"}`,
    `${limits.companies} ${limits.companies === 1 ? "company" : "companies"}`,
    `${limits.staffUsers} staff accounts`,
  ];
}

export const plans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
    monthlyPrice: 999,
    annualPrice: 9990,
    limits: { employees: 75, branches: 2, companies: 1, staffUsers: 5 },
    features: [
      "Employee Management",
      "CRM Management",
      "Attendance Tracking",
      "Payroll Management",
      "Basic Reports",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "Built for growing businesses",
    monthlyPrice: 2499,
    annualPrice: 24990,
    popular: true,
    limits: { employees: 250, branches: 10, companies: 3, staffUsers: 15 },
    features: [
      "Everything in Starter",
      "Advanced CRM",
      "Leave Management",
      "Advanced Reports",
      "Multi-branch Management",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    description: "For large business operations",
    monthlyPrice: 5999,
    annualPrice: 59990,
    limits: { employees: 1000, branches: 50, companies: 10, staffUsers: 100 },
    features: [
      "Everything in Growth",
      "Multiple Companies",
      "Advanced Payroll",
      "Roles & Permissions",
      "Activity Audit",
      "Priority Support",
    ],
  },
];
