import { useToastState } from '../../../src/ui/useToastState';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { AppIcon } from "../../../src/ui/AppIcon";

import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';

import { leaveApi } from "../../../src/core/admin/api";
import { documentDate } from "../../../src/features/employee/data";
import { WorkspaceIcon } from "../../../src/features/employee/components";
import { useEmployeeStyles } from "../../../src/features/employee/styles";
import { useEmployeeWorkspace } from "../../../src/features/employee/workspace";

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

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Unable to cancel leave request.");
}

export default function LeaveScreen() {
  const s = useEmployeeStyles();
  const {
    employeeName,
    employeeProfile,
    leaveTypes,
    leaveRequests,
    leaveLoading,
    leaveSaving,
    leaveError,
    leaveBalance,
    pendingLeaveDays,
    canCancelLeaveRequest,
    openLeave,
    refreshLeave,
  } = useEmployeeWorkspace();

  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useToastState("", 'error');
  const [notice, setNotice] = useToastState("", 'success');

  const canApply =
    !!employeeProfile &&
    !leaveLoading &&
    !leaveSaving &&
    leaveError === "" &&
    leaveTypes.length > 0;

  const selectedRequest = leaveRequests.find(
    (request) => request.id === cancelId,
  );

  const openCancellation = (id: string) => {
    if (cancelling || leaveSaving) return;

    const request = leaveRequests.find(
      (item) => item.id === id,
    );

    if (!request || !canCancelLeaveRequest(request)) {
      setNotice("This request is not eligible for cancellation.", 'info');
      return;
    }

    setCancelError("");
    setNotice("");
    setCancelId(id);
  };

  const closeCancellation = () => {
    if (cancelling) return;
    setCancelId(null);
    setCancelError("");
  };

  const confirmCancellation = async () => {
    if (!cancelId || cancelling || leaveSaving) return;

    const request = leaveRequests.find(
      (item) => item.id === cancelId,
    );

    if (!request || !canCancelLeaveRequest(request)) {
      setCancelError(
        "This request is no longer eligible for cancellation.",
      );
      return;
    }

    setCancelling(true);
    setCancelError("");
    setNotice("");

    try {
      await leaveApi.cancel(request.id);

      setCancelId(null);
      setNotice("Your leave request was cancelled successfully.");
      refreshLeave();
    } catch (error) {
      setCancelError(getErrorMessage(error));

      // Refresh from PostgreSQL in case the server processed
      // the cancellation but its response was interrupted.
      refreshLeave();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={s.leavePage}>
      <View>
        <AdminPageHeading title="My leave">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply for leave"
            accessibilityState={{ disabled: !canApply }}
            disabled={!canApply}
            onPress={openLeave}
            style={({ pressed }) => [
              s.leaveApply,
              (pressed || !canApply) && { opacity: 0.55 },
            ]}
          >
            <Text style={s.buttonText}>+ Apply</Text>
          </Pressable>
        </AdminPageHeading>
      </View>

      {!!notice && (
        <View
          style={[
            s.leaveRequestCard,
            { marginTop: 12, backgroundColor: "#E7F6EF" },
          ]}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: "#176B4F", fontWeight: "600" }}
          >
            {notice}
          </Text>
        </View>
      )}

      {leaveLoading && (
        <View style={[s.leaveRequestCard, { marginTop: 16 }]}>
          <ActivityIndicator color="#11786D" />
          <Text style={[s.leaveRequestReason, { marginTop: 10 }]}>
            Loading leave information...
          </Text>
        </View>
      )}

      {!!leaveError && !leaveLoading && (
        <View style={[s.leaveRequestCard, { marginTop: 16 }]}>
          <Text style={s.leaveEmployeeName}>
            Leave information unavailable
          </Text>

          <Text style={s.leaveRequestReason}>
            {leaveError}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={refreshLeave}
            style={s.leaveCancel}
          >
            <Text style={s.leaveCancelText}>
              Retry loading
            </Text>
          </Pressable>
        </View>
      )}

      <View style={s.leaveBalances}>
        {leaveTypes.map((entry) => {
          const balance = leaveBalance(entry.name);
          const pending = pendingLeaveDays(entry.name);

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
                  ? "Not allocated"
                  : `${balance} days`}
              </Text>

              <Text style={s.leaveBalanceHint}>
                Allocated balance remaining
              </Text>

              <Text style={[s.leaveBalanceHint, { marginTop: 4 }]}>
                Annual policy allowance:{" "}
                {entry.annualAllowance} days
              </Text>

              <Text style={[s.leaveBalanceHint, { marginTop: 4 }]}>
                Pending requests: {pending} days
              </Text>

              <Text style={[s.leaveBalanceHint, { marginTop: 4 }]}>
                {entry.isPaid ? "Paid leave" : "Unpaid leave"}
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
              Ask your administrator to configure leave
              types for your assigned company.
            </Text>
          </View>
        )}

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
          Paid-leave balances come from your company's
          allocated leave records. Pending requests do not
          deduct the balance until approval. Approved future
          paid leave is refunded if successfully cancelled.
        </Text>
      </View>

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
            disabled={leaveLoading || cancelling}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                color: "#11786D",
                fontSize: 12,
                fontWeight: "700",
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

            const canCancel =
              canCancelLeaveRequest(request);

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
                      <Text style={s.leaveRequestInitials}>
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
                        request.status === "REJECTED" && {
                          color: "#B94D61",
                        },
                        request.status === "CANCELLED" && {
                          color: "#5F7088",
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

                {!!request.reviewNote && (
                  <Text
                    style={[
                      s.leaveRequestReason,
                      { marginTop: 8 },
                    ]}
                  >
                    Review note: {request.reviewNote}
                  </Text>
                )}

                {canCancel && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel ${requestType} request`}
                    disabled={
                      cancelling ||
                      leaveSaving ||
                      leaveLoading
                    }
                    onPress={() =>
                      openCancellation(request.id)
                    }
                    style={({ pressed }) => [
                      s.leaveCancel,
                      (pressed ||
                        cancelling ||
                        leaveSaving) && {
                        opacity: 0.6,
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

      <Modal
        transparent
        visible={cancelId !== null}
        animationType="fade"
        onRequestClose={closeCancellation}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(16,30,45,0.45)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 18,
              backgroundColor: "#FFFFFF",
              padding: 24,
              gap: 16,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: "#20334F",
              }}
            >
              Cancel leave request
            </Text>

            {selectedRequest && (
              <Text
                style={{
                  fontSize: 13,
                  color: "#405573",
                  lineHeight: 21,
                }}
              >
                {selectedRequest.startDate.slice(0, 10)}
                {" to "}
                {selectedRequest.endDate.slice(0, 10)}
                {" · "}
                {selectedRequest.days} day(s)
              </Text>
            )}

            <Text
              style={{
                fontSize: 13,
                color: "#64748B",
                lineHeight: 21,
              }}
            >
              Your request will be marked as Cancelled.
              Future approved paid leave will be refunded
              to your available balance.
            </Text>

            {!!cancelError && (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  color: "#DC2626",
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                {cancelError}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={cancelling}
              onPress={confirmCancellation}
              style={{
                minHeight: 46,
                borderRadius: 12,
                backgroundColor: "#DC2626",
                justifyContent: "center",
                alignItems: "center",
                opacity: cancelling ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "700",
                }}
              >
                {cancelling
                  ? "Cancelling..."
                  : "Confirm cancellation"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={cancelling}
              onPress={closeCancellation}
              style={{
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#DCE5F3",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontWeight: "600",
                  color: "#405573",
                }}
              >
                Keep request
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
