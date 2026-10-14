
import React from "react";

import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  documentDate,
} from "../../../src/features/employee/data";

import {
  WorkspaceIcon,
} from "../../../src/features/employee/components";

import { s } from "../../../src/features/employee/styles";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export default function LeaveScreen() {
  const {
    employeeName,
    employeeProfile,

    leaveTypes,
    leaveRequests,
    leaveLoading,
    leaveSaving,
    leaveError,

    leaveBalance,
    openLeave,
    openCancelLeave,
    refreshLeave,
  } = useEmployeeWorkspace();

  const canApply =
    !!employeeProfile &&
    !leaveLoading &&
    !leaveSaving &&
    !leaveError &&
    leaveTypes.length > 0;

  return (
    <View style={s.leavePage}>
      {/* HEADER */}

      <View>
        <View style={s.between}>
          <View style={s.flex}>
            <Text style={s.leaveEyebrow}>
              BRANCHSUITE WORKSPACE
            </Text>

            <Text
              accessibilityRole="header"
              style={s.leaveTitle}
            >
              My leave
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply for leave"
            accessibilityState={{
              disabled: !canApply,
            }}
            disabled={!canApply}
            onPress={openLeave}
            style={({ pressed }) => [
              s.leaveApply,
              (pressed || !canApply) && {
                opacity: 0.65,
              },
            ]}
          >
            <Text style={s.buttonText}>
              + Apply
            </Text>
          </Pressable>
        </View>

        <Text style={s.leaveSubtitle}>
          Take time off with a clear view
          of your requests and available balance.
        </Text>
      </View>

      {/* LOADING */}

      {leaveLoading && (
        <View
          style={[
            s.leaveRequestCard,
            { marginTop: 16 },
          ]}
        >
          <ActivityIndicator color="#11786D" />

          <Text
            style={[
              s.leaveRequestReason,
              { marginTop: 10 },
            ]}
          >
            Loading leave information...
          </Text>
        </View>
      )}

      {/* ERROR */}

      {!!leaveError && !leaveLoading && (
        <View
          style={[
            s.leaveRequestCard,
            { marginTop: 16 },
          ]}
        >
          <Text style={s.leaveEmployeeName}>
            Leave information unavailable
          </Text>

          <Text style={s.leaveRequestReason}>
            {leaveError}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={refreshLeave}
            style={({ pressed }) => [
              s.leaveCancel,
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text style={s.leaveCancelText}>
              Retry loading
            </Text>
          </Pressable>
        </View>
      )}

      {/* BALANCES */}

      <View style={s.leaveBalances}>
        {leaveTypes.map((entry) => {
          const balance = leaveBalance(entry.name);

          return (
            <View
              key={entry.id}
              style={s.leaveBalanceCard}
            >
              <View style={s.row}>
                <WorkspaceIcon
                  symbol="calendar"
                  size={18}
                />

                <Text style={s.leaveBalanceLabel}>
                  {entry.name}
                </Text>
              </View>

              <Text style={s.leaveBalanceValue}>
                {balance === null
                  ? "—"
                  : `${balance} days`}
              </Text>

              <Text style={s.leaveBalanceHint}>
                Estimated available balance
              </Text>

              <Text
                style={[
                  s.leaveBalanceHint,
                  { marginTop: 4 },
                ]}
              >
                Annual allowance:{" "}
                {entry.annualAllowance} days
              </Text>
            </View>
          );
        })}
      </View>

      {!leaveLoading &&
        !leaveError &&
        leaveTypes.length === 0 && (
          <View style={s.leaveRequestCard}>
            <Text style={s.leaveEmployeeName}>
              No leave types configured
            </Text>

            <Text style={s.leaveRequestReason}>
              Ask your administrator to configure
              leave types for your company.
            </Text>
          </View>
        )}

      {/* POLICY NOTE */}

      <View style={s.leaveNotice}>
        <View
          accessibilityElementsHidden
          style={s.documentNoticeIcon}
        >
          <Text style={s.documentNoticeIconText}>
            i
          </Text>
        </View>

        <Text style={s.leaveNoticeText}>
          Estimated balances use the annual allowance
          configured by your company and reserve days
          for pending and approved requests.
          Final eligibility and calculations are
          determined by your company's leave policy.
        </Text>
      </View>

      {/* REQUEST HISTORY */}

      <View style={s.leaveRequests}>
        <View
          style={[
            s.between,
            { alignItems: "center" },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={s.leaveRequestsTitle}
          >
            My requests
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={refreshLeave}
            disabled={leaveLoading}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
              pressed && { opacity: 0.65 },
            ]}
          >
            <Text
              style={{
                color: "#11786D",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              Refresh
            </Text>
          </Pressable>
        </View>

        {leaveRequests.length > 0 ? (
          leaveRequests.map((request) => {
            const days = Number(request.days);
            const label = statusLabel(request.status);

            const requestType =
              leaveTypes.find(
                (item) =>
                  item.id === request.leaveTypeId,
              )?.name ??
              request.leaveType?.name ??
              "Leave";

            return (
              <View
                key={request.id}
                style={s.leaveRequestCard}
              >
                <View
                  style={[
                    s.between,
                    { alignItems: "flex-start" },
                  ]}
                >
                  <View style={[s.row, s.flex]}>
                    <View style={s.leaveRequestAvatar}>
                      <Text
                        style={s.leaveRequestInitials}
                      >
                        {employeeName
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={s.flex}>
                      <Text style={s.leaveEmployeeName}>
                        {employeeName}
                      </Text>

                      <Text style={s.leaveRequestType}>
                        {requestType}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      s.leaveStatus,
                      request.status === "APPROVED" &&
                        s.leaveStatusApproved,
                      request.status === "CANCELLED" &&
                        s.leaveStatusCancelled,
                    ]}
                  >
                    <Text
                      style={[
                        s.leaveStatusText,
                        request.status === "APPROVED" && {
                          color: "#217663",
                        },
                        request.status === "CANCELLED" && {
                          color: "#5F7088",
                        },
                        request.status === "REJECTED" && {
                          color: "#B94D61",
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </View>

                <Text style={s.leaveRequestDates}>
                  {documentDate(
                    request.startDate.slice(0, 10),
                  )}
                  {" – "}
                  {documentDate(
                    request.endDate.slice(0, 10),
                  )}
                  {" · "}
                  {days} {days === 1 ? "day" : "days"}
                </Text>

                <Text style={s.leaveRequestReason}>
                  {request.reason}
                </Text>

                {request.status === "PENDING" && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel ${requestType} request`}
                    disabled={leaveSaving}
                    onPress={() =>
                      openCancelLeave(request.id)
                    }
                    style={({ pressed }) => [
                      s.leaveCancel,
                      (pressed || leaveSaving) && {
                        opacity: 0.65,
                      },
                    ]}
                  >
                    <Text style={s.leaveCancelText}>
                      Cancel request
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        ) : !leaveLoading && !leaveError ? (
          <View style={s.leaveRequestCard}>
            <Text style={s.leaveEmployeeName}>
              No leave requests yet
            </Text>

            <Text style={s.leaveRequestReason}>
              Requests submitted to BranchSuite
              will appear here.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
