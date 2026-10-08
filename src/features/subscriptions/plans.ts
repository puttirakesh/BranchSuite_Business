
export type BillingCycle = "monthly" | "annual";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  employees: number;
  branches: number;
  companies: number;
  users: number;
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
    employees: 75,
    branches: 2,
    companies: 1,
    users: 5,
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
    employees: 250,
    branches: 10,
    companies: 3,
    users: 15,
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
    employees: 1000,
    branches: 50,
    companies: 10,
    users: 100,
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
