export type PayslipSettings = {
  address?: string; logoDataUrl?: string; accentColor?: string; footer?: string;
  showBankDetails?: boolean; showIdentifiers?: boolean; showPaidDays?: boolean;
  showDepartment?: boolean; showDesignation?: boolean; showBranch?: boolean;
};
export type PayrollCalendar = { weeklyOffDays: number[]; holidays: string[] };
