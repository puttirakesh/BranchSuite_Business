
import React from "react";

import {
  Text,
  View,
} from "react-native";

import {
  s,
} from "../../../src/features/employee/styles";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";

// =====================================================
// EMPLOYEE HELP SCREEN
// =====================================================

export default function HelpScreen() {
  const {
    employeeName,
    employeeCompany,
    employeeBranch,
    employeeDepartment,
    profileLoading,
    profileError,
  } = useEmployeeWorkspace();

  const helpSections = [
    {
      title: "Attendance",
      description:
        "Check in and check out using your Employee Workspace. You can view your recorded shifts and attendance history in the Attendance section.",
    },
    {
      title: "Tasks",
      description:
        "Open My Tasks to see work assigned to you. View task details, update the task status, and submit progress notes using the Task Management screen.",
    },
    {
      title: "Leave & requests",
      description:
        "Open Leave & Requests to select an available leave type, submit an application, and track its approval status. Pending leave requests can be cancelled.",
    },
    {
      title: "Payroll",
      description:
        "Your payroll information will be available here after the employee payslip integration is completed. Contact your company administrator for payroll questions.",
    },
    {
      title: "My documents",
      description:
        "Employment letters and verified documents will appear when the Documents module is connected to your company's backend records. For now, request official documents from your administrator or HR team.",
    },
    {
      title: "Salary advances",
      description:
        "Salary advance requests are not yet connected to the backend. Information entered in the current Advances screen is local to this device and is not submitted to your employer.",
    },
    {
      title: "Need help?",
      description:
        employeeCompany !== "Not assigned"
          ? `For employment, attendance, leave, or payroll assistance, contact your manager, HR team, or administrator at ${employeeCompany}.`
          : "For employment, attendance, leave, or payroll assistance, contact your manager, HR team, or company administrator.",
    },
  ];

  return (
    <View style={s.column}>
      {/* EMPLOYEE INFORMATION */}

      <View
        style={[
          s.card,
          {
            gap: 8,
          },
        ]}
      >
        <Text style={s.cardTitle}>
          Employee support
        </Text>

        {profileLoading ? (
          <Text style={s.small}>
            Loading employee information...
          </Text>
        ) : profileError ? (
          <Text
            accessibilityRole="alert"
            style={s.error}
          >
            {profileError}
          </Text>
        ) : (
          <>
            <Text style={s.body}>
              Employee: {employeeName}
            </Text>

            <Text style={s.small}>
              Company: {employeeCompany}
            </Text>

            <Text style={s.small}>
              Branch: {employeeBranch}
            </Text>

            <Text style={s.small}>
              Department: {employeeDepartment}
            </Text>
          </>
        )}
      </View>

      {/* HELP TOPICS */}

      {helpSections.map((section) => (
        <View
          key={section.title}
          style={[
            s.card,
            {
              gap: 8,
            },
          ]}
        >
          <Text style={s.cardTitle}>
            {section.title}
          </Text>

          <Text style={s.body}>
            {section.description}
          </Text>
        </View>
      ))}
    </View>
  );
}
