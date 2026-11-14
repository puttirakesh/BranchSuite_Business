import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { toast } from '../../../src/ui/toast-store';
import { useToastState } from '../../../src/ui/useToastState';
import { SelectField } from '../../../src/ui/SelectField';
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { isEmail, type InputValidation } from '../../../src/shared/validation/input';
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";

import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { departmentsApi, employeesApi, usersApi, type DepartmentDto, type EmployeeGender, type EmployeeProfileDto, type UserDto } from '../../../src/core/admin/api';
import { useAdminScope } from '../../../src/core/admin/scope';
import { reportingManagerOptions } from '../../../src/core/admin/reporting-managers';
import { displayComponentName, formatInr } from '../../../src/core/salary-breakdown';
import { initialSalaryComponents, salaryStructureTotals, parseSalaryStructure, type SalaryComponentInput } from '../../../src/core/payroll-structure';
import { SalaryBreakdownEditor, type BreakdownState } from '../../../src/ui/SalaryBreakdownEditor';
import { DatePickerField } from '../../../src/ui/DatePickerField';
import { calendarDateKey, isAllowedCalendarDate } from '../../../src/shared/validation/date';

import {
  addEmployee,
  type EmployeeProfile,
} from '../../../src/core/employees';

import { useAvailableBranches } from '../../../src/core/admin/available-branches';
import { BranchOptionsStatus } from '../../../src/ui/BranchOptionsStatus';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ToastModal as Modal } from '../../../src/ui/Toast';

import { SafeAreaView } from 'react-native-safe-area-context';

// =====================================================
// FIELD COMPONENT
// =====================================================

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  onOpenCalendar?: () => void;
  disabled?: boolean;
  numeric?: boolean;
  password?: boolean;
  maxLength?: number;
  validation?: InputValidation;
  comfortableSpacing?: boolean;
  onRetryCheck?: () => void;
};

const employeeGenderOptions: { value: EmployeeGender | ''; label: string }[] = [
  { value: '', label: 'Not specified' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

function Field({
  label,
  value,
  onChangeText,
  hint,
  error,
  keyboardType = 'default',
  onOpenCalendar,
  disabled = false,
  numeric = false,
  password = false,
  maxLength,
  validation,
  comfortableSpacing = false,
  onRetryCheck,
}: FieldProps) {
  const { styles } = useAdminLayout(baseStyles, 'form');

  return (
    <View style={[styles.field, comfortableSpacing && styles.comfortableField]}>

      <View>
        <TextInput
          validation={validation}
          label={label}
          invalid={!!error}
          accessibilityLabel={label}
          style={[
            styles.input,
            onOpenCalendar && styles.dateInput,
            error ? styles.inputError : undefined,
          ]}
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          keyboardType={
            numeric ? 'decimal-pad' : keyboardType
          }
          secureTextEntry={password}
          autoCapitalize={
            password || keyboardType === 'email-address'
              ? 'none'
              : 'words'
          }
          autoCorrect={false}
          maxLength={maxLength}
          autoComplete={
            password
              ? 'new-password'
              : keyboardType === 'email-address'
                ? 'email'
                : undefined
          }
        />

        {onOpenCalendar && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open joining date calendar"
            disabled={disabled}
            onPress={onOpenCalendar}
            style={styles.calendarButton}
          >
            <View
              accessible={false}
              style={styles.calendarIcon}
            >
              <View
                style={[
                  styles.calendarBinding,
                  { left: 3 },
                ]}
              />

              <View
                style={[
                  styles.calendarBinding,
                  { right: 3 },
                ]}
              />

              <View style={styles.calendarDivider} />

              <View style={styles.calendarDots}>
                {[0, 1, 2, 3].map(dot => (
                  <View
                    key={dot}
                    style={styles.calendarDot}
                  />
                ))}
              </View>
            </View>
          </Pressable>
        )}
      </View>

      {hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}
      {error && onRetryCheck ? (
        <Pressable accessibilityRole="button" onPress={onRetryCheck} style={styles.managerRetry}>
          <Text style={styles.managerRetryText}>Retry check</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type EmployeeDuplicateField = 'email' | 'bankAccountNumber' | 'pan' | 'uan';
type DuplicateCheckStatus = 'idle' | 'checking' | 'available' | 'duplicate' | 'error';

function isValidDuplicateCheckValue(field: EmployeeDuplicateField, value: string): boolean {
  switch (field) {
    case 'email': return isEmail(value);
    case 'bankAccountNumber': return /^\d{9,18}$/.test(value);
    case 'pan': return /^[A-Z]{5}\d{4}[A-Z]$/.test(value);
    case 'uan': return /^\d{12}$/.test(value);
  }
  return false;
}

function useEmployeeDuplicateCheck(
  companyId: string | undefined,
  branchId: string | undefined,
  field: EmployeeDuplicateField,
  rawValue: string,
) {
  const value = field === 'email' ? rawValue.trim().toLowerCase()
    : field === 'pan' ? rawValue.trim().toUpperCase()
      : rawValue.trim();
  const requestKey = `${companyId ?? ''}:${branchId ?? ''}:${field}:${value}`;
  const [result, setResult] = useState<{ key: string; status: DuplicateCheckStatus }>({ key: '', status: 'idle' });
  const [retryVersion, setRetryVersion] = useState(0);
  const valid = isValidDuplicateCheckValue(field, value);

  useEffect(() => {
    if (!companyId || !branchId || !valid) {
      setResult({ key: requestKey, status: 'idle' });
      return;
    }

    let active = true;
    setResult({ key: requestKey, status: 'checking' });
    const timer = setTimeout(() => {
      employeesApi.checkDuplicate({ companyId, branchId, field, value })
        .then(({ available }) => {
          if (active) setResult({ key: requestKey, status: available ? 'available' : 'duplicate' });
        })
        .catch(() => {
          if (active) setResult({ key: requestKey, status: 'error' });
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [companyId, branchId, field, value, valid, requestKey, retryVersion]);

  const status = result.key === requestKey
    ? result.status
    : valid && companyId && branchId ? 'checking' : 'idle';
  const label = field === 'email' ? 'email' : field === 'bankAccountNumber' ? 'bank account number' : field === 'pan' ? 'PAN' : 'PF UAN';
  const message = status === 'duplicate'
    ? field === 'email'
      ? 'This email address is already in use.'
      : `This ${label} is already used by an employee in this company.`
    : status === 'error'
      ? `Could not verify this ${label}. Check your connection and try again.`
      : undefined;
  const hint = status === 'checking'
    ? `Checking whether this ${label} is already in use…`
    : undefined;

  return { status, message, hint, retry: () => setRetryVersion(current => current + 1) };
}

// =====================================================
// CREATE EMPLOYEE SCREEN
// =====================================================

export default function CreateEmployee() {
  const { styles } = useAdminLayout(baseStyles, 'form');
  const router = useRouter();
  const params = useLocalSearchParams<{ branchId?: string }>();
  const scope = useAdminScope();

  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);

  const [step, setStep] = useState(0);

  const [grossAmount, setGrossAmount] = useState('');
  const [breakdown, setBreakdown] = useState<BreakdownState>({ state: 'idle' });
  const [basicAmount, setBasicAmount] = useState('');
  const [salaryComponents, setSalaryComponents] = useState<SalaryComponentInput[]>(initialSalaryComponents);
  const [payrollDetails, setPayrollDetails] = useState({
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    bankIfsc: '',
    pan: '',
    uan: '',
  });

  const [employmentStatus, setEmploymentStatus] =
    useState<'active' | 'inactive'>('active');

  const [statusOpen, setStatusOpen] = useState(false);

  const [loginEnabled, setLoginEnabled] = useState(true);

  // No predictable default password.
  const [temporaryPassword, setTemporaryPassword] =
    useState('');

  const [assignedCrmTasks, setAssignedCrmTasks] =
    useState(true);

  const [payErrors, setPayErrors] =
    useState<Record<string, string>>({});
  const salaryTotals = salaryStructureTotals(basicAmount, salaryComponents);

  const [profile, setProfile] = useState<EmployeeProfile>({
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    department: '',
    gender: '' as EmployeeGender | '',
    dateOfBirth: '',
    branch: '',
    reportingManager: '',
    joiningDate: '',
  });

  const [errors, setErrors] =
    useState<
      Partial<Record<keyof EmployeeProfile, string>>
    >({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useToastState('', 'error');
  const [managerDirectory, setManagerDirectory] = useState<{ companyId: string; users: UserDto[]; profiles: EmployeeProfileDto[] } | null>(null);
  const [managersLoading, setManagersLoading] = useState(true);
  const [managersError, setManagersError] = useToastState('', 'error');
  const [managerAttempt, setManagerAttempt] = useState(0);
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [departmentDirectory, setDepartmentDirectory] = useState<{ companyId: string; items: DepartmentDto[] } | null>(null);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useToastState('', 'error');
  const departmentOptions = useMemo(() => {
    const departments = new Map<string, string>();
    if (departmentDirectory?.companyId === scope?.companyId) {
      for (const department of departmentDirectory?.items ?? []) {
        const name = department.name.trim();
        const inBranch = !profile.branchId || !department.branchId || department.branchId === profile.branchId;
        if (department.companyId === scope?.companyId && inBranch && name && !departments.has(name.toLowerCase())) {
          departments.set(name.toLowerCase(), name);
        }
      }
    }
    return [...departments.values()].sort((a, b) => a.localeCompare(b)).map(name => ({ value: `department:${name}`, label: name }));
  }, [departmentDirectory, scope?.companyId, profile.branchId]);
  const managerOptions = useMemo(() => managerDirectory && managerDirectory.companyId === scope?.companyId
    ? reportingManagerOptions(managerDirectory.users, managerDirectory.profiles, managerDirectory.companyId, profile.branchId ?? '', profile.email)
    : [], [managerDirectory, scope?.companyId, profile.branchId, profile.email]);
  const emailDuplicateCheck = useEmployeeDuplicateCheck(scope?.companyId, profile.branchId, 'email', profile.email);
  const emailAlreadyInDirectory = !!profile.email.trim() &&
    managerDirectory !== null &&
    managerDirectory.companyId === scope?.companyId &&
    managerDirectory.profiles.some(employee =>
      employee.user.email.trim().toLowerCase() === profile.email.trim().toLowerCase() ||
      employee.workEmail?.trim().toLowerCase() === profile.email.trim().toLowerCase()
    );
  const emailDuplicateMessage = emailAlreadyInDirectory || emailDuplicateCheck.status === 'duplicate'
    ? 'Email already exists.'
    : emailDuplicateCheck.message;
  const bankAccountDuplicateCheck = useEmployeeDuplicateCheck(scope?.companyId, profile.branchId, 'bankAccountNumber', payrollDetails.bankAccountNumber);
  const panDuplicateCheck = useEmployeeDuplicateCheck(scope?.companyId, profile.branchId, 'pan', payrollDetails.pan);
  const uanDuplicateCheck = useEmployeeDuplicateCheck(scope?.companyId, profile.branchId, 'uan', payrollDetails.uan);

  useFocusEffect(useCallback(() => {
    if (!scope?.companyId) return;
    let active = true;
    const companyId = scope.companyId;
    setManagersLoading(true);
    setManagersError('');
    setManagerDirectory(current => current?.companyId === companyId ? current : null);
    setDepartmentsLoading(true);
    setDepartmentsError('');
    setDepartmentDirectory(current => current?.companyId === companyId ? current : null);
    departmentsApi.list(companyId)
      .then(items => { if (active) setDepartmentDirectory({ companyId, items }); })
      .catch(() => {
        if (active) setDepartmentsError('Could not load departments. Try again.');
      })
      .finally(() => { if (active) setDepartmentsLoading(false); });
    Promise.all([employeesApi.reportingManagers(companyId), employeesApi.list(companyId)])
      .then(([users, profiles]) => { if (active) setManagerDirectory({ companyId, users, profiles }); })
      .catch(cause => { if (active) setManagersError(cause instanceof Error ? cause.message : 'Could not load reporting managers.'); })
      .finally(() => { if (active) setManagersLoading(false); });
    return () => { active = false; };
  }, [scope?.companyId, managerAttempt]));

  useEffect(() => {
    if (profile.department && !departmentOptions.some(option => option.value === `department:${profile.department}`)) {
      setProfile(current => ({ ...current, department: '' }));
    }
  }, [departmentOptions, profile.department]);

  useEffect(() => {
    if (!reportingManagerId) return;
    const selected = managerOptions.find(option => option.value === reportingManagerId);
    if (!selected) setReportingManagerId('');
    setProfile(current => current.reportingManager === (selected?.label ?? '')
      ? current : { ...current, reportingManager: selected?.label ?? '' });
  }, [managerOptions, reportingManagerId]);

  const [calendarOpen, setCalendarOpen] =
    useState(false);

  const [calendarMonth, setCalendarMonth] = useState(
    () =>
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
  );

  const {
    branches: branchOptions,
    loading: branchesLoading,
    error: branchError,
    refresh: refreshBranches,
  } = useAvailableBranches();

  // ===================================================
  // LOAD BRANCHES
  // ===================================================

  useEffect(() => {
    if (branchesLoading || branchError) return;
    setProfile(current => {
      const selected = branchOptions.find(branch => branch.id === current.branchId)
        ?? branchOptions.find(branch => branch.id === params.branchId)
        ?? (branchOptions.length === 1 ? branchOptions[0] : undefined);
      return { ...current, branch: selected?.name ?? '', branchId: selected?.id ?? '' };
    });
  }, [branchOptions, branchesLoading, branchError, params.branchId]);

  // ===================================================
  // NAVIGATION
  // ===================================================

  const goToStep = (next: number) => {
    if (savingRef.current) return;

    setStep(next);
    setSaveError('');

    scrollRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  };

  const back = () => {
    if (savingRef.current) return;

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/employees');
    }
  };

  // ===================================================
  // UPDATE PROFILE
  // ===================================================

  const update =
    (key: keyof EmployeeProfile) =>
    (value: string) => {
      if (savingRef.current) return;

      setProfile(current => ({
        ...current,
        [key]: value,
      }));

      setErrors(current => ({
        ...current,
        [key]: undefined,
      }));

      setSaveError('');
    };

  const updatePayrollDetail =
    (key: keyof typeof payrollDetails) =>
    (value: string) => {
      if (savingRef.current) return;
      setPayrollDetails(current => ({ ...current, [key]: value }));
      setPayErrors(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setSaveError('');
    };

  // ===================================================
  // CALENDAR
  // ===================================================

  const openCalendar = () => {
    if (savingRef.current) return;

    Keyboard.dismiss();

    const match =
      /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(
        profile.joiningDate.trim()
      );

    const selected = match
      ? new Date(
          Number(match[4]),
          Number(match[3]) - 1,
          Number(match[1])
        )
      : null;

    const date =
      selected &&
      selected.getFullYear() === Number(match?.[4]) &&
      selected.getMonth() === Number(match?.[3]) - 1 &&
      selected.getDate() === Number(match?.[1])
        ? selected
        : new Date();

    setCalendarMonth(
      new Date(date.getFullYear(), date.getMonth(), 1)
    );

    setCalendarOpen(true);
  };

  const chooseDate = (date: Date) => {
    if (savingRef.current) return;

    update('joiningDate')(
      `${String(date.getDate()).padStart(2, '0')}/` +
      `${String(date.getMonth() + 1).padStart(2, '0')}/` +
      `${date.getFullYear()}`
    );

    setCalendarOpen(false);
  };

  const firstWeekday = calendarMonth.getDay();

  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate();

  const weeks = Array.from(
    {
      length: Math.ceil(
        (firstWeekday + daysInMonth) / 7
      ),
    },
    (_, week) =>
      Array.from({ length: 7 }, (_, weekday) => {
        const day =
          week * 7 + weekday - firstWeekday + 1;

        return day > 0 && day <= daysInMonth
          ? day
          : null;
      })
  );

  // ===================================================
  // PROFILE VALIDATION
  // ===================================================

  const validateProfile = (): boolean => {
    const nextErrors: Partial<
      Record<keyof EmployeeProfile, string>
    > = {};

    if (!profile.fullName.trim()) {
      nextErrors.fullName =
        'Enter the employee’s full name.';
    } else if (profile.fullName.trim().length > 150) {
      nextErrors.fullName =
        'Name cannot exceed 150 characters.';
    }

    const email = profile.email.trim().toLowerCase();

    if (!isEmail(email)) {
      nextErrors.email = 'Enter a valid work email.';
    } else if (emailAlreadyInDirectory || emailDuplicateCheck.status !== 'available') {
      nextErrors.email = emailDuplicateMessage
        ?? (emailDuplicateCheck.status === 'checking'
          ? 'Wait for the email check to finish.'
          : 'Choose an active branch to check this email.');
    }

    if (profile.phone.trim() && !/^\d{10}$/.test(profile.phone.trim())) {
      nextErrors.phone =
        'Enter a 10-digit phone number.';
    }

    if (managersLoading || managersError || !managerOptions.some(option => option.value === reportingManagerId)) {
      nextErrors.reportingManager =
        'Choose an available reporting manager for this branch.';
    }

    if (!profile.branchId) {
      nextErrors.branch = 'Choose a branch.';
    }

    if (profile.department && !departmentOptions.some(option => option.value === `department:${profile.department}`)) {
      nextErrors.department = 'Choose an available department.';
    }

    if (profile.dateOfBirth && !isAllowedCalendarDate(profile.dateOfBirth, undefined, calendarDateKey(new Date()))) {
      nextErrors.dateOfBirth = 'Enter a valid date of birth that is not in the future.';
    }

    const match =
      /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(
        profile.joiningDate.trim()
      );

    if (!match) {
      nextErrors.joiningDate =
        'Enter a valid date as DD/MM/YYYY or DD-MM-YYYY.';
    } else {
      const day = Number(match[1]);
      const month = Number(match[3]);
      const year = Number(match[4]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        nextErrors.joiningDate =
          'Enter a valid joining date.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ===================================================
  // PAY AND LOGIN VALIDATION
  // ===================================================

  const validatePay = (): boolean => {
    const next: Record<string, string> = {};
    if (breakdown.state === 'loading') next.salary = 'The salary breakdown is still calculating. Please wait a moment.';
    else if (breakdown.state === 'error') next.salary = breakdown.error ?? 'The salary breakdown could not be calculated.';
    else if (breakdown.state !== 'ready') next.salary = 'Enter the monthly gross salary.';
    else {
      try {
        const salary = parseSalaryStructure(basicAmount, salaryComponents);
        if (salary.gross <= 0) next.salary = 'Monthly gross salary must be greater than zero.';
      } catch (error) {
        next.salary = error instanceof Error ? error.message : 'Enter valid salary amounts.';
      }
    }

    if (!payrollDetails.bankName.trim()) next.bankName = 'Enter the employee’s bank name.';
    else if (payrollDetails.bankName.trim().length > 100) next.bankName = 'Bank name cannot exceed 100 characters.';
    if (!payrollDetails.bankBranch.trim()) next.bankBranch = 'Enter the employee’s bank branch.';
    else if (payrollDetails.bankBranch.trim().length > 100) next.bankBranch = 'Bank branch cannot exceed 100 characters.';
    if (!payrollDetails.bankAccountNumber.trim()) {
      next.bankAccountNumber = 'Enter the employee’s bank account number.';
    } else if (!/^\d{9,18}$/.test(payrollDetails.bankAccountNumber.trim())) {
      next.bankAccountNumber = 'Enter an account number containing 9 to 18 digits.';
    } else if (bankAccountDuplicateCheck.status !== 'available') {
      next.bankAccountNumber = bankAccountDuplicateCheck.message
        ?? (bankAccountDuplicateCheck.status === 'checking'
          ? 'Wait for the bank account check to finish.'
          : 'Choose an active branch to check this account number.');
    }
    if (!payrollDetails.bankIfsc.trim()) {
      next.bankIfsc = 'Enter the employee’s IFSC.';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(payrollDetails.bankIfsc.trim().toUpperCase())) {
      next.bankIfsc = 'Enter a valid 11-character IFSC.';
    }
    if (!payrollDetails.pan.trim()) {
      next.pan = 'Enter the employee’s PAN.';
    } else if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(payrollDetails.pan.trim().toUpperCase())) {
      next.pan = 'Enter a valid PAN.';
    } else if (panDuplicateCheck.status !== 'available') {
      next.pan = panDuplicateCheck.message
        ?? (panDuplicateCheck.status === 'checking'
          ? 'Wait for the PAN check to finish.'
          : 'Choose an active branch to check this PAN.');
    }
    if (!payrollDetails.uan.trim()) {
      next.uan = 'Enter the employee’s 12-digit PF UAN.';
    } else if (!/^\d{12}$/.test(payrollDetails.uan.trim())) {
      next.uan = 'UAN must contain exactly 12 digits.';
    } else if (uanDuplicateCheck.status !== 'available') {
      next.uan = uanDuplicateCheck.message
        ?? (uanDuplicateCheck.status === 'checking'
          ? 'Wait for the PF UAN check to finish.'
          : 'Choose an active branch to check this PF UAN.');
    }

    if (
      loginEnabled &&
      (
        !temporaryPassword.trim() ||
        temporaryPassword.length < 8 ||
        temporaryPassword.length > 128
      )
    ) {
      next.password =
        'Temporary password must contain 8 to 128 characters.';
    }

    setPayErrors(next);

    return Object.keys(next).length === 0;
  };

  // ===================================================
  // CONTINUE / SAVE
  // ===================================================

  const continueProfile = async () => {
    if (savingRef.current) return;

    if (step === 0) {
      if (validateProfile()) goToStep(1);
      return;
    }

    if (step === 1) {
      if (validatePay()) goToStep(2);
      return;
    }

    // Revalidate before writing to the database.
    if (!validateProfile() || !validatePay()) {
      setSaveError(
        'Please review the employee information and pay settings.'
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      const employee = await addEmployee(
        {
          ...profile,
          reportingManagerId,
          joiningDate: profile.joiningDate
            .trim()
            .replace(/-/g, '/'),
        },
        {
          monthlyGrossSalary: salaryTotals.gross,
          monthlyDeductions: salaryTotals.deductions,
          basicAmount,
          salaryComponents,
          bankAccountNumber: payrollDetails.bankAccountNumber,
          bankName: payrollDetails.bankName,
          bankBranch: payrollDetails.bankBranch,
          bankIfsc: payrollDetails.bankIfsc,
          pan: payrollDetails.pan,
          uan: payrollDetails.uan,
          status: employmentStatus,
          loginEnabled,
          assignedCrmTasks:
            loginEnabled && assignedCrmTasks,

          // Passwords must not be trimmed.
          temporaryPassword,
        }
      );

      setTemporaryPassword('');
      toast.success('Employee added successfully.');

      router.replace('/admin/employees');
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Could not save the employee. Please try again.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View
        style={styles.flex}

      >
        <View style={styles.page}>
          {/* HEADER */}



          {/* MAIN CONTENT */}

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <AdminPageHeading title="Add employee" onBack={back} backDisabled={saving} />

            {/* WIZARD STEPS */}

            <View style={styles.wizardSteps}>
              {[
                'Profile',
                'Pay & login',
                'Review',
              ].map((label, index) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{
                    selected: step === index,
                    disabled:
                      saving || index > step + 1,
                  }}
                  disabled={
                    saving || index > step + 1
                  }
                  onPress={() =>
                    index <= step
                      ? goToStep(index)
                      : continueProfile()
                  }
                  style={styles.wizardStep}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      index === step &&
                        styles.stepActive,
                      index < step &&
                        styles.stepDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepNumber,
                        index === step &&
                          styles.stepActiveText,
                      ]}
                    >
                      {index < step ? '✓' : index + 1}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.stepLabel,
                      index === step &&
                        styles.stepSelectedText,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* STEP 1: PROFILE */}

            {step === 0 && (
              <View
                style={[styles.card, styles.formCard]}
              >
                <Text style={styles.cardTitle}>
                  Who is joining your team
                </Text>

                <Field validation={{ kind: 'name', required: true }}
                  label="Full name *"
                  value={profile.fullName}
                  onChangeText={update('fullName')}
                  error={errors.fullName}
                  disabled={saving}
                  maxLength={150}
                />

                <Field validation={{ required: true }}
                  label="Work email *"
                  value={profile.email}
                  onChangeText={update('email')}
                  keyboardType="email-address"
                  hint={emailDuplicateCheck.hint ?? 'Used for employee sign-in.'}
                  error={emailDuplicateMessage ?? (emailDuplicateCheck.status === 'checking' || emailDuplicateCheck.status === 'available' ? undefined : errors.email)}
                  onRetryCheck={!emailAlreadyInDirectory && emailDuplicateCheck.status === 'error' ? emailDuplicateCheck.retry : undefined}
                  disabled={saving}
                  maxLength={254}
                />

                <Field validation={{ maxLength: 10 }}
                  label="Phone (optional)"
                  value={profile.phone}
                  onChangeText={update('phone')}
                  keyboardType="phone-pad"
                  error={errors.phone}
                  disabled={saving}
                  maxLength={30}
                />

                <Field validation={{ maxLength: 100 }}
                  label="Job title (optional)"
                  value={profile.jobTitle}
                  onChangeText={update('jobTitle')}
                  disabled={saving}
                />

                <View style={styles.field}>
                  <SelectField
                    label="Department"
                    value={profile.department ? `department:${profile.department}` : ''}
                    options={[
                      { value: '', label: 'Select department' },
                      ...departmentOptions,
                    ]}
                    disabled={saving || departmentsLoading || !!departmentsError}
                    onChange={value => {
                      update('department')(value.startsWith('department:') ? value.slice('department:'.length) : '');
                    }}
                  />
                  {departmentsLoading && <Text style={styles.hint}>Loading departments…</Text>}
                  {!!departmentsError && <View>
                    <Text accessibilityRole="alert" style={styles.error}>{departmentsError}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Retry loading departments" disabled={saving} onPress={() => setManagerAttempt(value => value + 1)} style={styles.managerRetry}>
                      <Text style={styles.managerRetryText}>Retry</Text>
                    </Pressable>
                  </View>}
                  {!departmentsLoading && !departmentsError && <Text style={styles.hint}>
                    {departmentOptions.length
                      ? profile.branchId ? `Departments in ${profile.branch}.` : 'Departments in this company. Choose a branch to filter the list.'
                      : profile.branchId ? 'No departments are recorded for this branch.' : 'No departments are recorded for this company.'}
                  </Text>}
                  {!!errors.department && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors.department}</Text>}
                </View>

                {/* BRANCH */}

                <View style={styles.field}>
                  <SelectField label="Branch *" labelInside value={profile.branchId ?? ''} options={branchOptions.map(branch => ({ value: branch.id, label: branch.name }))} disabled={saving || branchesLoading || !!branchError} onChange={id => {
                    const branch = branchOptions.find(option => option.id === id);
                    if (!branch) return;
                    setProfile(current => ({ ...current, branch: branch.name, branchId: branch.id }));
                    setErrors(current => ({ ...current, branch: undefined }));
                  }} />
                  <BranchOptionsStatus
                    loading={branchesLoading}
                    error={branchError}
                    empty={branchOptions.length === 0}
                    onRetry={refreshBranches}
                  />

                  {errors.branch && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.error}
                    >
                      {errors.branch}
                    </Text>
                  )}
                </View>

                <View style={styles.field}>
                  <SelectField
                    label="Reporting manager *"
                    value={reportingManagerId}
                    options={managerOptions}
                    disabled={saving || managersLoading || !!managersError || !profile.branchId || managerOptions.length === 0}
                    onChange={id => {
                      const manager = managerOptions.find(option => option.value === id);
                      if (!manager) return;
                      setReportingManagerId(id);
                      update('reportingManager')(manager.label);
                    }}
                  />
                  {managersLoading && <Text style={styles.hint}>Loading reporting managers…</Text>}
                  {!!managersError && <View>
                    <Text accessibilityRole="alert" style={styles.error}>{managersError}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Retry loading reporting managers" disabled={saving} onPress={() => setManagerAttempt(value => value + 1)} style={styles.managerRetry}>
                      <Text style={styles.managerRetryText}>Retry</Text>
                    </Pressable>
                  </View>}
                  {!managersLoading && !managersError && <Text style={styles.hint}>
                    {!profile.branchId ? 'Choose a branch to see reporting managers.'
                      : managerOptions.length ? 'Active managers and administrators for this branch.'
                      : 'No active reporting managers are available for this branch. Assign a manager in Roles & branch access.'}
                  </Text>}
                  {!!errors.reportingManager && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors.reportingManager}</Text>}
                </View>

                <Field validation={{ kind: 'date', startsWith: 'digit', required: true, maxLength: 10, pattern: /^\d{2}[/-]\d{2}[/-]\d{4}$/, patternMessage: 'Use DD/MM/YYYY or DD-MM-YYYY.' }}
                  label="Joining date *"
                  value={profile.joiningDate}
                  onChangeText={update('joiningDate')}
                  hint="DD/MM/YYYY or DD-MM-YYYY"
                  error={errors.joiningDate}
                  onOpenCalendar={openCalendar}
                  disabled={saving}
                />

                <Text style={styles.cardTitle}>Personal details</Text>
                <View style={styles.field}>
                  <SelectField
                    label="Gender (optional)"
                    value={profile.gender}
                    options={employeeGenderOptions}
                    disabled={saving}
                    onChange={value => {
                      const gender = employeeGenderOptions.find(option => option.value === value)?.value;
                      if (gender !== undefined) update('gender')(gender);
                    }}
                  />
                </View>

                <View style={styles.field}>
                  <DatePickerField
                    label="Date of birth (optional)"
                    value={profile.dateOfBirth}
                    onChange={update('dateOfBirth')}
                    maxDate={calendarDateKey(new Date())}
                    disabled={saving}
                    style={styles.input}
                  />
                  {!!errors.dateOfBirth && <Text accessibilityLiveRegion="polite" style={styles.error}>{errors.dateOfBirth}</Text>}
                </View>
              </View>
            )}

            {/* STEP 2: PAY & LOGIN */}

            {step === 1 && (
              <View
                style={[styles.card, styles.formCard]}
              >
                <Text style={styles.cardTitle}>Pay & login</Text>

                <SalaryBreakdownEditor
                  companyId={scope?.companyId}
                  grossAmount={grossAmount}
                  onGrossAmountChange={setGrossAmount}
                  components={salaryComponents}
                  onComponentsChange={setSalaryComponents}
                  onBasicAmountChange={setBasicAmount}
                  onStatusChange={setBreakdown}
                  showCard={false}
                  suggestIndianDefaults
                  disabled={saving}
                />
                {!!payErrors.salary && <Text accessibilityLiveRegion="polite" style={styles.error}>{payErrors.salary}</Text>}

                <Text style={styles.cardTitle}>Payroll details</Text>
                <Field validation={{ kind: 'name', required: true, maxLength: 100 }}
                  label="Bank name *"
                  value={payrollDetails.bankName}
                  onChangeText={updatePayrollDetail('bankName')}
                  error={payErrors.bankName}
                  disabled={saving}
                  maxLength={100}
                  comfortableSpacing
                />
                <Field validation={{ kind: 'text', required: true, maxLength: 100 }}
                  label="Bank branch *"
                  value={payrollDetails.bankBranch}
                  onChangeText={updatePayrollDetail('bankBranch')}
                  error={payErrors.bankBranch}
                  disabled={saving}
                  maxLength={100}
                  comfortableSpacing
                />
                <Field validation={{ kind: 'text', required: true, minLength: 9, maxLength: 18, pattern: /^\d{9,18}$/, patternMessage: 'Enter an account number containing 9 to 18 digits.' }}
                  label="Bank account number *"
                  value={payrollDetails.bankAccountNumber}
                  onChangeText={value => {
                    if (/^\d*$/.test(value)) updatePayrollDetail('bankAccountNumber')(value);
                  }}
                  keyboardType="phone-pad"
                  hint={bankAccountDuplicateCheck.hint ?? 'The full account number is not stored; only its last four digits appear on payslips.'}
                  error={bankAccountDuplicateCheck.message ?? (bankAccountDuplicateCheck.status === 'checking' || bankAccountDuplicateCheck.status === 'available' ? undefined : payErrors.bankAccountNumber)}
                  onRetryCheck={bankAccountDuplicateCheck.status === 'error' ? bankAccountDuplicateCheck.retry : undefined}
                  disabled={saving}
                  maxLength={18}
                  comfortableSpacing
                />
                <Field validation={{ kind: 'code', required: true, startsWith: 'letter', pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/, patternMessage: 'Enter a valid 11-character IFSC.' }}
                  label="IFSC *"
                  value={payrollDetails.bankIfsc}
                  onChangeText={value => updatePayrollDetail('bankIfsc')(value.toUpperCase())}
                  error={payErrors.bankIfsc}
                  disabled={saving}
                  maxLength={11}
                  comfortableSpacing
                />
                <Field validation={{ kind: 'code', required: true, startsWith: 'letter', pattern: /^[A-Z]{5}\d{4}[A-Z]$/, patternMessage: 'Enter a valid PAN.' }}
                  label="PAN *"
                  value={payrollDetails.pan}
                  onChangeText={value => updatePayrollDetail('pan')(value.toUpperCase())}
                  hint={panDuplicateCheck.hint}
                  error={panDuplicateCheck.message ?? (panDuplicateCheck.status === 'checking' || panDuplicateCheck.status === 'available' ? undefined : payErrors.pan)}
                  onRetryCheck={panDuplicateCheck.status === 'error' ? panDuplicateCheck.retry : undefined}
                  disabled={saving}
                  maxLength={10}
                  comfortableSpacing
                />
                <Field validation={{ kind: 'integer', required: true, minLength: 12, maxLength: 12 }}
                  label="PF UAN *"
                  value={payrollDetails.uan}
                  onChangeText={updatePayrollDetail('uan')}
                  keyboardType="phone-pad"
                  hint={uanDuplicateCheck.hint}
                  error={uanDuplicateCheck.message ?? (uanDuplicateCheck.status === 'checking' || uanDuplicateCheck.status === 'available' ? undefined : payErrors.uan)}
                  onRetryCheck={uanDuplicateCheck.status === 'error' ? uanDuplicateCheck.retry : undefined}
                  disabled={saving}
                  maxLength={12}
                  comfortableSpacing
                />
                {/* EMPLOYMENT STATUS */}

                <View style={[styles.field, styles.comfortableField]}>
                  <Text style={styles.label}>
                    Employment status
                  </Text>

                  {Platform.OS === 'web'
                    ? React.createElement(
                        'select',
                        {
                          'aria-label':
                            'Employment status',
                          value: employmentStatus,
                          disabled: saving,
                          onChange: (
                            event: React.ChangeEvent<HTMLSelectElement>
                          ) =>
                            setEmploymentStatus(
                              event.target.value as
                                | 'active'
                                | 'inactive'
                            ),
                          style: {
                            width: '100%',
                            minHeight: 48,
                            border: '1px solid #dce5f3',
                            borderRadius: 13,
                            padding: '11px 13px',
                            background: '#fcfdff',
                            color: '#20334f',
                            fontSize: 14,
                          },
                        },
                        (
                          ['active', 'inactive'] as const
                        ).map(value =>
                          React.createElement(
                            'option',
                            {
                              key: value,
                              value,
                            },
                            value === 'active'
                              ? 'Active'
                              : 'Inactive'
                          )
                        )
                      )
                    : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Employment status"
                        disabled={saving}
                        onPress={() =>
                          setStatusOpen(true)
                        }
                        style={[
                          styles.input,
                          styles.between,
                        ]}
                      >
                        <Text style={styles.statusValue}>
                          {employmentStatus === 'active'
                            ? 'Active'
                            : 'Inactive'}
                        </Text>
                      </Pressable>
                    )}
                </View>

                {/* LOGIN ACCESS */}

                <View style={styles.accessSection}>
                  <View style={styles.loginToggleRow}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="Enable employee login"
                      accessibilityState={{
                        checked: loginEnabled,
                        disabled: saving,
                      }}
                      disabled={saving}
                      onPress={() => {
                        setLoginEnabled(value => !value);
                        setPayErrors(current => ({
                          ...current,
                          password: '',
                        }));
                      }}
                      style={[styles.checkRow, styles.loginToggle]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          loginEnabled && styles.checked,
                        ]}
                      >
                        <AppIcon symbol={loginEnabled ? '✓' : ''} style={styles.checkmark} />
                      </View>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.checkTitle, styles.loginToggleLabel]}>
                        Employee login
                      </Text>
                    </Pressable>

                    {loginEnabled && (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel="Show assigned CRM tasks"
                        accessibilityState={{
                          checked: assignedCrmTasks,
                          disabled: saving,
                        }}
                        disabled={saving}
                        onPress={() => setAssignedCrmTasks(value => !value)}
                        style={[styles.checkRow, styles.loginToggle]}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            assignedCrmTasks && styles.checked,
                          ]}
                        >
                          <AppIcon symbol={assignedCrmTasks ? '✓' : ''} style={styles.checkmark} />
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.checkTitle, styles.loginToggleLabel]}>
                          CRM tasks
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {loginEnabled && (
                    <Field validation={{ kind: 'password', required: true, minLength: 8 }}
                      label="Temporary password *"
                      value={temporaryPassword}
                      onChangeText={value => {
                        setTemporaryPassword(value);
                        setPayErrors(current => ({
                          ...current,
                          password: '',
                        }));
                      }}
                      password
                      maxLength={128}
                      disabled={saving}
                      comfortableSpacing
                      hint="8–128 characters; share securely."
                      error={payErrors.password}
                    />
                  )}
                </View>
              </View>
            )}

            {/* STEP 3: REVIEW */}

            {step === 2 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Review employee
                </Text>

                {[
                  ['Full name', profile.fullName],
                  ['Work email', profile.email],
                  ['Employee code', 'Assigned automatically after saving'],
                  ['Department', profile.department.trim() || 'Not assigned'],
                  ['Job title', profile.jobTitle.trim() || 'Not assigned'],
                  ['System role', 'Employee'],
                  ['Gender', profile.gender ? profile.gender.replace(/_/g, ' ').toLowerCase() : 'Not specified'],
                  ['Date of birth', profile.dateOfBirth || 'Not provided'],
                  ['Branch', profile.branch],
                  [
                    'Reporting manager',
                    profile.reportingManager,
                  ],
                  ['Joining date', profile.joiningDate],
                  ['Monthly gross salary', formatInr(salaryTotals.gross)],
                  ['Basic salary', formatInr(basicAmount || 0)],
                  ...salaryComponents.filter(item => Number(item.amount) > 0).map(item => [displayComponentName(item.name), formatInr(item.amount)]),
                  ['Total deductions', formatInr(salaryTotals.deductions)],
                  ['Estimated net salary', formatInr(salaryTotals.gross - salaryTotals.deductions)],
                  ['Bank name', payrollDetails.bankName || 'Not provided'],
                  ['Bank branch', payrollDetails.bankBranch || 'Not provided'],
                  ['Bank account', payrollDetails.bankAccountNumber ? `XXXX${payrollDetails.bankAccountNumber.trim().slice(-4)}` : 'Not provided'],
                  ['IFSC', payrollDetails.bankIfsc || 'Not provided'],
                  ['PAN', payrollDetails.pan || 'Not provided'],
                  ['PF UAN', payrollDetails.uan || 'Not provided'],
                  [
                    'Employment status',
                    employmentStatus === 'active'
                      ? 'Active'
                      : 'Inactive',
                  ],
                  [
                    'Employee login',
                    loginEnabled
                      ? 'Enabled'
                      : 'Disabled',
                  ],
                  [
                    'Assigned CRM tasks',
                    loginEnabled && assignedCrmTasks
                      ? 'Shown'
                      : 'Hidden',
                  ],
                ].map(([label, value]) => (
                  <View
                    key={label}
                    style={styles.reviewRow}
                  >
                    <Text style={styles.label}>
                      {label}
                    </Text>

                    <Text style={styles.statusValue}>
                      {value}
                    </Text>
                  </View>
                ))}

              </View>
            )}
          </ScrollView>

          {/* SAVE ERROR */}

          {saveError !== '' && (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.saveError}
            >
              {saveError}
            </Text>
          )}

          {/* ACTIONS */}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={step > 0 ? 'Previous step' : 'Cancel employee creation'}
              disabled={saving}
              onPress={() =>
                step > 0
                  ? goToStep(step - 1)
                  : back()
              }
              style={[styles.cancelButton, step > 0 && styles.backIconOnly]}
            >
              {step > 0 ? <AppIcon symbol="‹" size={16} color="#000" /> : <Text style={styles.cancelText}>Cancel</Text>}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: saving,
                busy: saving,
              }}
              disabled={saving}
              onPress={continueProfile}
              style={({ pressed }) => [
                styles.continueButton,
                (pressed || saving) &&
                  styles.pressed,
              ]}
            >
              <Text style={styles.continueText}>
                {saving
                  ? 'Adding…'
                  : step === 2
                    ? 'Add employee'
                    : 'Continue'}
              </Text>
            </Pressable>
          </View>

          <AdminBottomNavigation disabled={saving} />
        </View>
      </View>

      {/* STATUS MODAL */}

      <Modal
        transparent
        visible={statusOpen}
        animationType="fade"
        onRequestClose={() => setStatusOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setStatusOpen(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.calendarTitle}>
              Employment status
            </Text>

            {(['active', 'inactive'] as const).map(
              value => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => {
                    setEmploymentStatus(value);
                    setStatusOpen(false);
                  }}
                  style={styles.reviewRow}
                >
                  <Text style={styles.statusValue}>
                    {value === 'active'
                      ? 'Active'
                      : 'Inactive'}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </Pressable>
      </Modal>

      {/* CALENDAR MODAL */}

      <Modal
        transparent
        visible={calendarOpen}
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View style={styles.overlay}>
          <View
            accessibilityViewIsModal
            style={styles.modal}
          >
            <View style={styles.between}>
              <Text style={styles.calendarTitle}>
                Joining date
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close joining date calendar"
                onPress={() => setCalendarOpen(false)}
                style={styles.calendarControl}
              >
                <AppIcon symbol="×" style={styles.calendarControlText} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.monthHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={
                    calendarMonth.getFullYear() <= 100 &&
                    calendarMonth.getMonth() === 0
                  }
                  onPress={() =>
                    setCalendarMonth(
                      date =>
                        new Date(
                          date.getFullYear(),
                          date.getMonth() - 1,
                          1
                        )
                    )
                  }
                  style={styles.calendarControl}
                >
                  <AppIcon symbol="‹" style={styles.calendarControlText} />
                </Pressable>

                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.monthTitle}
                >
                  {calendarMonth.toLocaleDateString(
                    'en-IN',
                    {
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  disabled={
                    calendarMonth.getFullYear() >= 9999 &&
                    calendarMonth.getMonth() === 11
                  }
                  onPress={() =>
                    setCalendarMonth(
                      date =>
                        new Date(
                          date.getFullYear(),
                          date.getMonth() + 1,
                          1
                        )
                    )
                  }
                  style={styles.calendarControl}
                >
                  <AppIcon symbol="›" style={styles.calendarControlText} />
                </Pressable>
              </View>

              <View style={styles.calendarRow}>
                {[
                  'Sun',
                  'Mon',
                  'Tue',
                  'Wed',
                  'Thu',
                  'Fri',
                  'Sat',
                ].map(day => (
                  <Text
                    key={day}
                    style={styles.weekday}
                  >
                    {day}
                  </Text>
                ))}
              </View>

              {weeks.map((week, index) => (
                <View
                  key={index}
                  style={styles.calendarRow}
                >
                  {week.map((day, weekday) => {
                    if (day === null) {
                      return (
                        <View
                          key={weekday}
                          style={styles.calendarDay}
                        />
                      );
                    }

                    const date = new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth(),
                      day
                    );

                    const match =
                      /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(
                        profile.joiningDate.trim()
                      );

                    const selected =
                      !!match &&
                      day === Number(match[1]) &&
                      date.getMonth() + 1 ===
                        Number(match[3]) &&
                      date.getFullYear() ===
                        Number(match[4]);

                    return (
                      <Pressable
                        key={weekday}
                        accessibilityRole="button"
                        accessibilityLabel={date.toLocaleDateString(
                          'en-IN',
                          {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }
                        )}
                        accessibilityState={{
                          selected,
                        }}
                        onPress={() =>
                          chooseDate(date)
                        }
                        style={[
                          styles.calendarDay,
                          selected &&
                            styles.selectedDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            selected &&
                              styles.selectedDayText,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Select today"
                onPress={() =>
                  chooseDate(new Date())
                }
                style={styles.todayButton}
              >
                <Text style={styles.todayText}>
                  Today
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const baseStyles = StyleSheet.create({
  managerRetry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  managerRetryText: { color: '#345cf2', fontSize: 13, fontWeight: '600' },
  wizardSteps: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4eaf5',
    borderRadius: 16,
    padding: 12,
    marginTop: 20,
    gap: 6,
  },

  wizardStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
  },

  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e8edf6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepActive: {
    backgroundColor: '#345cf2',
  },

  stepDone: {
    backgroundColor: '#dff2ec',
  },

  stepNumber: {
    fontSize: 11,
    color: '#607591',
    fontWeight: '700',
  },

  stepActiveText: {
    color: '#fff',
  },

  stepLabel: {
    fontSize: 10,
    color: '#405573',
    flexShrink: 1,
  },

  stepSelectedText: {
    color: '#345cf2',
  },

  statusValue: {
    fontSize: 14,
    color: '#20334f',
  },

  accessSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#dce5f3',
    paddingTop: 18,
  },

  loginToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fafbfe',
    borderWidth: 1,
    borderColor: '#edf1f8',
    borderRadius: 13,
    padding: 14,
    marginBottom: 18,
  },

  loginToggle: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 0,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#cbd6eb',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checked: {
    backgroundColor: '#345cf2',
    borderColor: '#345cf2',
  },

  checkmark: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  checkTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#20334f',
  },

  loginToggleLabel: {
    flex: 1,
    minWidth: 0,
  },

  reviewRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f8',
  },

  safe: {
    flex: 1,
    backgroundColor: '#f6f8fd',
  },

  flex: {
    flex: 1,
  },

  page: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },

  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4eaf5',
    backgroundColor: '#fff',
  },

  companyName: {
    minHeight: 18,
    fontSize: 14,
    fontWeight: '800',
    color: '#20334f',
  },

  headerCaption: {
    fontSize: 9,
    color: '#8794aa',
    marginTop: 4,
  },

  search: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#f5f7fc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchGlyph: {
    fontSize: 26,
    color: '#304560',
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#eaf0ff',
  },

  filters: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },

  filter: {
    flex: 1,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#f7f9ff',
    borderWidth: 1,
    borderColor: '#e4eaf7',
  },

  branchFilter: {
    backgroundColor: '#eaf0ff',
    borderColor: '#d5dfff',
  },

  filterLabel: {
    fontSize: 9,
    color: '#8492a9',
  },

  chevron: {
    fontSize: 17,
    color: '#8d9bb2',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    minHeight: 38,
    marginBottom: 6,
  },

  backChevron: {
    fontSize: 23,
    color: '#657995',
  },

  backText: {
    fontSize: 12,
    color: '#657995',
  },

  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: '#20334f',
  },

  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: '#7a8ba5',
    marginTop: 6,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4eaf5',
    padding: 18,
    marginTop: 22,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#20334f',
    marginBottom: 24,
  },

  field: {
    marginBottom: 20,
  },
  comfortableField: {
    marginBottom: 28,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#405573',
    marginBottom: 8,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#dce5f3',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#fcfdff',
    fontSize: 14,
    color: '#20334f',
  },

  inputError: {
    borderColor: '#cc6574',
  },

  dateInput: {
    paddingRight: 52,
  },

  calendarButton: {
    position: 'absolute',
    right: 1,
    top: 1,
    bottom: 1,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarIcon: {
    width: 19,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#405573',
    borderRadius: 3,
    marginTop: 2,
  },

  calendarBinding: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor: '#405573',
  },

  calendarDivider: {
    height: 1.5,
    backgroundColor: '#405573',
    marginTop: 4,
  },

  calendarDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 9,
    gap: 3,
    alignSelf: 'center',
    marginTop: 3,
  },

  calendarDot: {
    width: 3,
    height: 3,
    borderRadius: 0.5,
    backgroundColor: '#405573',
  },

  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: 'rgba(21,43,60,0.25)',
  },

  modal: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    alignSelf: 'center',
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#fff',
  },

  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#20334f',
  },

  calendarControl: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f4fa',
  },

  calendarControlText: {
    fontSize: 24,
    color: '#405573',
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },

  monthTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },

  calendarRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 4,
  },

  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    fontSize: 10,
    color: '#71829c',
  },

  calendarDay: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    fontSize: 14,
    color: '#20334f',
  },

  selectedDay: {
    backgroundColor: '#345cf2',
  },

  selectedDayText: {
    color: '#fff',
    fontWeight: '700',
  },

  todayButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#edf1ff',
  },

  todayText: {
    color: '#345cf2',
    fontSize: 13,
    fontWeight: '600',
  },

  hint: {
    fontSize: 10,
    color: '#8192ad',
    marginTop: 6,
    lineHeight: 15,
  },

  salaryTotals: {
    gap: 4,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5f7fc',
  },

  salaryNet: {
    color: '#20334f',
    fontSize: 12,
    fontWeight: '700',
  },

  error: {
    fontSize: 11,
    color: '#b94d61',
    marginTop: 6,
  },

  saveError: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    color: '#b94d61',
    backgroundColor: '#fff',
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4eaf5',
  },

  cancelButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#f1f4fa',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIconOnly: {
    flex: 0,
    width: 44,
    backgroundColor: 'transparent',
  },

  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#405573',
  },

  continueButton: {
    flex: 1.15,
    minHeight: 44,
    backgroundColor: '#345cf2',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  pressed: {
    opacity: 0.85,
  },

  navigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4eaf5',
    paddingTop: 8,
    paddingBottom: 8,
  },

  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },

  navIcon: {
    minWidth: 46,
    height: 32,
    borderRadius: 13,
  },

  selectedNav: {
    backgroundColor: '#eaf0ff',
  },

  navGlyph: {
    fontSize: 22,
    color: '#71829c',
  },

  navLabel: {
    fontSize: 9,
    color: '#71829c',
  },

  selectedText: {
    color: '#345cf2',
  },
});
