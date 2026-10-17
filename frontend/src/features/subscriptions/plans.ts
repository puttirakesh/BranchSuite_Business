
export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  popular?: boolean;
  features: string[];
};

export const plans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
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
