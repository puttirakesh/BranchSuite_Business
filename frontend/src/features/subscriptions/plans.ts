
export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
};

export const plans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
    monthlyPrice: 999,
    annualPrice: 9990,
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
