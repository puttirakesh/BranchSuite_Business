
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { AdminMenuIcon } from '../../../src/ui/AdminMenuIcon';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';

import React, { useEffect, useRef, useState } from 'react';

import {
  addEmployee,
  type EmployeeProfile,
} from '../../../src/core/employees';

import { getCompanyBranches } from '../../../src/core/admin/scope';
import { useRouter } from 'expo-router';

import {
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
};

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
}: FieldProps) {
  const { styles } = useAdminLayout(baseStyles, 'form');

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View>
        <TextInput
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
    </View>
  );
}

// =====================================================
// CREATE EMPLOYEE SCREEN
// =====================================================

export default function CreateEmployee() {
  const { styles } = useAdminLayout(baseStyles, 'form');
  const router = useRouter();

  const scrollRef = useRef<ScrollView>(null);
  const savingRef = useRef(false);

  const [step, setStep] = useState(0);

  const [gross, setGross] = useState('45000');
  const [deductions, setDeductions] = useState('0');
  const [bankEnding, setBankEnding] = useState('');

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

  const [profile, setProfile] = useState<EmployeeProfile>({
    fullName: '',
    email: '',
    phone: '',
    jobTitle: '',
    department: '',
    branch: '',
    reportingManager: '',
    joiningDate: '',
  });

  const [errors, setErrors] =
    useState<
      Partial<Record<keyof EmployeeProfile, string>>
    >({});

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  const [branchOptions, setBranchOptions] = useState<
    { id: string; name: string }[]
  >([]);

  const [branchError, setBranchError] = useState('');

  // ===================================================
  // LOAD BRANCHES
  // ===================================================

  useEffect(() => {
    let active = true;

    getCompanyBranches()
      .then(branches => {
        if (!active) return;

        const options = branches
          .filter(branch => branch.status === 'ACTIVE')
          .map(branch => ({
            id: branch.id,
            name: branch.name,
          }));

        setBranchOptions(options);

        if (options.length === 1) {
          setProfile(current =>
            current.branchId
              ? current
              : {
                  ...current,
                  branch: options[0].name,
                  branchId: options[0].id,
                }
          );
        }
      })
      .catch(error => {
        if (active) {
          setBranchError(
            error instanceof Error
              ? error.message
              : 'Could not load branches.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
      router.replace('/admin/dashboard');
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

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      nextErrors.email = 'Enter a valid work email.';
    }

    if (profile.phone.trim().length > 30) {
      nextErrors.phone =
        'Phone number cannot exceed 30 characters.';
    }

    if (!profile.reportingManager.trim()) {
      nextErrors.reportingManager =
        'Enter the reporting manager.';
    }

    if (!profile.branchId) {
      nextErrors.branch = 'Choose a branch.';
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

    const grossValue = Number(gross);
    const deductionsValue = Number(deductions);

    if (
      !gross.trim() ||
      !Number.isFinite(grossValue) ||
      grossValue < 0
    ) {
      next.gross = 'Enter a valid salary.';
    }

    if (
      !deductions.trim() ||
      !Number.isFinite(deductionsValue) ||
      deductionsValue < 0 ||
      deductionsValue > grossValue
    ) {
      next.deductions =
        'Enter deductions between zero and the gross salary.';
    }

    if (
      bankEnding &&
      !/^\d{4}$/.test(bankEnding)
    ) {
      next.bankEnding =
        'Enter the last four digits only.';
    }

    if (
      loginEnabled &&
      (
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
          joiningDate: profile.joiningDate
            .trim()
            .replace(/-/g, '/'),
        },
        {
          monthlyGrossSalary: Number(gross),
          monthlyDeductions: Number(deductions),
          bankEnding,
          status: employmentStatus,
          loginEnabled,
          assignedCrmTasks:
            loginEnabled && assignedCrmTasks,

          // Passwords must not be trimmed.
          temporaryPassword,
        }
      );

      setTemporaryPassword('');

      router.replace({
        pathname: '/admin/employees',
        params: { added: employee.id },
      });
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios' ? 'padding' : 'height'
        }
      >
        <View style={styles.page}>
          {/* HEADER */}

          <View style={styles.header}>
            <View
              style={[styles.between, styles.headerIdentity]}
            >
              <View style={styles.flex}>
                <Text style={styles.companyName} />
                <Text style={styles.headerCaption}>
                  Business workspace
                </Text>
              </View>

              <View style={styles.search}>
                <Text style={styles.searchGlyph}>⌕</Text>
              </View>

              <View style={styles.avatar} />
            </View>

            <View style={styles.filters}>
              <View style={styles.filter}>
                <Text style={styles.filterLabel}>
                  Company
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </View>

              <View
                style={[
                  styles.filter,
                  styles.branchFilter,
                ]}
              >
                <Text style={styles.filterLabel}>
                  Branch
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </View>
            </View>
          </View>

          {/* MAIN CONTENT */}

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={back}
              style={styles.backButton}
            >
              <Text style={styles.backChevron}>‹</Text>
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <Text style={styles.title}>
              Add employee
            </Text>

            <Text style={styles.subtitle}>
              Three short steps. One connected employee record.
            </Text>

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
                  Who is joining your team?
                </Text>

                <Field
                  label="Full name *"
                  value={profile.fullName}
                  onChangeText={update('fullName')}
                  error={errors.fullName}
                  disabled={saving}
                  maxLength={150}
                />

                <Field
                  label="Work email *"
                  value={profile.email}
                  onChangeText={update('email')}
                  keyboardType="email-address"
                  hint="Used for employee sign-in."
                  error={errors.email}
                  disabled={saving}
                  maxLength={254}
                />

                <Field
                  label="Phone (optional)"
                  value={profile.phone}
                  onChangeText={update('phone')}
                  keyboardType="phone-pad"
                  error={errors.phone}
                  disabled={saving}
                  maxLength={30}
                />

                <Field
                  label="Job title (optional)"
                  value={profile.jobTitle}
                  onChangeText={update('jobTitle')}
                  disabled={saving}
                />

                <Field
                  label="Department"
                  value={profile.department}
                  onChangeText={update('department')}
                  disabled={saving}
                />

                {/* BRANCH */}

                <View style={styles.field}>
                  <Text style={styles.label}>
                    Branch *
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {branchOptions.map(option => {
                      const selected =
                        profile.branchId === option.id;

                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                            disabled: saving,
                          }}
                          disabled={saving}
                          onPress={() => {
                            setProfile(current => ({
                              ...current,
                              branch: option.name,
                              branchId: option.id,
                            }));

                            setErrors(current => ({
                              ...current,
                              branch: undefined,
                            }));
                          }}
                          style={[
                            styles.input,
                            {
                              flexGrow: 0,
                              width: 'auto',
                              minHeight: 40,
                              paddingVertical: 8,
                            },
                            selected && {
                              borderColor: '#345cf2',
                              backgroundColor: '#eaf0ff',
                            },
                          ]}
                        >
                          <Text style={styles.statusValue}>
                            {option.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {branchOptions.length === 0 &&
                    !branchError && (
                      <Text style={styles.hint}>
                        Loading branches…
                      </Text>
                    )}

                  {branchError !== '' && (
                    <Text style={styles.error}>
                      {branchError}
                    </Text>
                  )}

                  {errors.branch && (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.error}
                    >
                      {errors.branch}
                    </Text>
                  )}
                </View>

                <Field
                  label="Reporting manager *"
                  value={profile.reportingManager}
                  onChangeText={update('reportingManager')}
                  error={errors.reportingManager}
                  disabled={saving}
                />

                <Field
                  label="Joining date *"
                  value={profile.joiningDate}
                  onChangeText={update('joiningDate')}
                  hint="DD/MM/YYYY or DD-MM-YYYY"
                  error={errors.joiningDate}
                  onOpenCalendar={openCalendar}
                  disabled={saving}
                />
              </View>
            )}

            {/* STEP 2: PAY & LOGIN */}

            {step === 1 && (
              <View
                style={[styles.card, styles.formCard]}
              >
                <Text style={styles.cardTitle}>
                  Pay and employee access
                </Text>

                <Field
                  label="Monthly gross salary (₹) *"
                  value={gross}
                  onChangeText={setGross}
                  numeric
                  hint="Before deductions."
                  error={payErrors.gross}
                  disabled={saving}
                />

                <Field
                  label="Monthly deductions (₹) *"
                  value={deductions}
                  onChangeText={setDeductions}
                  numeric
                  hint="Fixed monthly deduction; no statutory tax calculation."
                  error={payErrors.deductions}
                  disabled={saving}
                />

                <Field
                  label="Bank ending (optional)"
                  value={bankEnding}
                  onChangeText={setBankEnding}
                  keyboardType="phone-pad"
                  hint="Last four digits only."
                  error={payErrors.bankEnding}
                  disabled={saving}
                  maxLength={4}
                />

                {/* EMPLOYMENT STATUS */}

                <View style={styles.field}>
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
                        <Text style={styles.chevron}>
                          ⌄
                        </Text>
                      </Pressable>
                    )}
                </View>

                {/* LOGIN ACCESS */}

                <View style={styles.accessSection}>
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
                    style={styles.checkRow}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        loginEnabled && styles.checked,
                      ]}
                    >
                      <Text style={styles.checkmark}>
                        {loginEnabled ? '✓' : ''}
                      </Text>
                    </View>

                    <View style={styles.flex}>
                      <Text style={styles.checkTitle}>
                        Enable employee login
                      </Text>

                      <Text style={styles.hint}>
                        A separate personal workspace
                        for this employee.
                      </Text>
                    </View>
                  </Pressable>

                  {loginEnabled && (
                    <>
                      <Field
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
                        hint="Use 8 to 128 characters. Share it securely with the employee."
                        error={payErrors.password}
                      />

                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel="Show assigned CRM tasks"
                        accessibilityState={{
                          checked: assignedCrmTasks,
                          disabled: saving,
                        }}
                        disabled={saving}
                        onPress={() =>
                          setAssignedCrmTasks(
                            value => !value
                          )
                        }
                        style={styles.checkRow}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            assignedCrmTasks &&
                              styles.checked,
                          ]}
                        >
                          <Text style={styles.checkmark}>
                            {assignedCrmTasks ? '✓' : ''}
                          </Text>
                        </View>

                        <View style={styles.flex}>
                          <Text style={styles.checkTitle}>
                            Show assigned CRM tasks
                          </Text>

                          <Text style={styles.hint}>
                            Employee sees tasks assigned
                            to their account, subject to
                            backend permissions.
                          </Text>
                        </View>
                      </Pressable>
                    </>
                  )}

                  <View style={styles.accessNote}>
                    <AdminMenuIcon
                      name="lock"
                      color="#345cf2"
                    />

                    <Text
                      style={[
                        styles.hint,
                        styles.flex,
                      ]}
                    >
                      Employee access does not include
                      business administration or payroll
                      approval permissions.
                    </Text>
                  </View>
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
                  ['Branch', profile.branch],
                  [
                    'Reporting manager',
                    profile.reportingManager,
                  ],
                  ['Joining date', profile.joiningDate],
                  [
                    'Monthly gross salary',
                    `₹${Number(gross).toLocaleString('en-IN')}`,
                  ],
                  [
                    'Monthly deductions',
                    `₹${Number(deductions).toLocaleString('en-IN')}`,
                  ],
                  [
                    'Bank ending',
                    bankEnding || 'Not provided',
                  ],
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

                <Text style={styles.hint}>
                  Creates the employee account,
                  employee profile and, when the gross
                  salary is greater than zero, a
                  monthly salary assignment. Bank
                  ending is not stored by the server.
                  A disabled login also excludes the
                  employee from self-attendance
                  and payroll eligibility.
                </Text>
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
              disabled={saving}
              onPress={() =>
                step > 0
                  ? goToStep(step - 1)
                  : back()
              }
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>
                {step > 0 ? 'Back' : 'Cancel'}
              </Text>
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
      </KeyboardAvoidingView>

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
                <Text
                  style={styles.calendarControlText}
                >
                  ×
                </Text>
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
                  <Text
                    style={styles.calendarControlText}
                  >
                    ‹
                  </Text>
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
                  <Text
                    style={styles.calendarControlText}
                  >
                    ›
                  </Text>
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
    minHeight: 32,
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

  accessNote: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f5f8ff',
    borderWidth: 1,
    borderColor: '#eaf0ff',
    borderRadius: 13,
    padding: 14,
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
