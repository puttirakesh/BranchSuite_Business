-- RenameIndex
ALTER INDEX "PayrollIncentive_period_idx" RENAME TO "PayrollIncentive_tenantId_companyId_branchId_year_month_idx";

-- RenameIndex
ALTER INDEX "PayrollIncentive_period_user_key" RENAME TO "PayrollIncentive_tenantId_companyId_branchId_userId_year_mo_key";
