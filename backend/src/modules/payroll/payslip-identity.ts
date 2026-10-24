export function payslipIdentity(company: { id: string; name: string; payslipSettings?: unknown; payslipSettingsVersion?: number }, branch: { name: string }, person: { name: string }, profile?: { employeeCode: string; department: string | null; designation: string | null; bankName?: string | null; bankEnding?: string | null; bankIfsc?: string | null; pan?: string | null; uan?: string | null } | null, legacy = false) {
  return {
    companyId: company.id, company: company.name, branch: branch.name, name: person.name,
    employeeId: profile?.employeeCode ?? '', department: profile?.department ?? '', designation: profile?.designation ?? '',
    bankName: profile?.bankName ?? '', bankAccount: profile?.bankEnding ? 'XXXX' + profile.bankEnding : '',
    bankIfsc: profile?.bankIfsc ?? '', pan: profile?.pan ?? '', uan: profile?.uan ?? '',
    settings: company.payslipSettings ?? {}, settingsVersion: company.payslipSettingsVersion ?? 1, legacy,
  };
}
