import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export type EmployeePayrollIdentityInput = {
  bankIfsc?: string | null;
  pan?: string | null;
  uan?: string | null;
};

export type EmployeeBankDetailsInput = {
  bankName?: string | null;
  bankBranch?: string | null;
  bankEnding?: string | null;
};

export function normalizeRequiredEmployeeBankAccountNumber(value?: string | null): string {
  const accountNumber = value?.trim() ?? '';
  if (!/^\d{9,18}$/.test(accountNumber)) {
    throw new BadRequestException('Enter a bank account number containing 9 to 18 digits.');
  }
  return accountNumber;
}

export function fingerprintEmployeeBankAccount(accountNumber: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured before checking bank account duplicates.');
  }
  return createHmac('sha256', secret)
    .update(`branchsuite:employee-bank-account:v1:${accountNumber}`)
    .digest('hex');
}

export function normalizeRequiredEmployeeBankDetails(input: EmployeeBankDetailsInput): {
  bankName: string;
  bankBranch: string;
  bankEnding: string;
} {
  const bankName = input.bankName?.trim() ?? '';
  const bankBranch = input.bankBranch?.trim() ?? '';
  const bankEnding = input.bankEnding?.trim() ?? '';

  if (!bankName || bankName.length > 100) {
    throw new BadRequestException('Enter a valid bank name (1 to 100 characters).');
  }
  if (!bankBranch || bankBranch.length > 100) {
    throw new BadRequestException('Enter a valid bank branch (1 to 100 characters).');
  }
  if (!/^\d{4}$/.test(bankEnding)) {
    throw new BadRequestException('The last four digits of the bank account are required.');
  }

  return { bankName, bankBranch, bankEnding };
}

export function normalizeRequiredEmployeePayrollIdentity(input: EmployeePayrollIdentityInput): {
  bankIfsc: string;
  pan: string;
  uan: string;
} {
  const bankIfsc = input.bankIfsc?.trim().toUpperCase() ?? '';
  const pan = input.pan?.trim().toUpperCase() ?? '';
  const uan = input.uan?.trim() ?? '';

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
    throw new BadRequestException('Enter a valid 11-character IFSC.');
  }
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
    throw new BadRequestException('Enter a valid PAN.');
  }
  if (!/^\d{12}$/.test(uan)) {
    throw new BadRequestException('PF UAN must contain exactly 12 digits.');
  }

  return { bankIfsc, pan, uan };
}
