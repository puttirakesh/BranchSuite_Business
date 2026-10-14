
import React, { useState } from "react";

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BlurView } from "expo-blur";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  navigation,
  displayDate,
} from "./data";

import {
  Button,
  Tile,
  Field,
} from "./components";

import { s } from "./styles";

import {
  useEmployeeWorkspace,
} from "./workspace";

// =====================================================
// HELPERS
// =====================================================

function formatBalance(
  balance: number | null,
): string {
  return balance === null
    ? "Unavailable"
    : `${balance} days`;
}

// =====================================================
// EMPLOYEE DIALOGS
// =====================================================

export function EmployeeDialogs() {
  const insets = useSafeAreaInsets();

  const [documentError, setDocumentError] =
    useState("");

  const {
    // Employee identity from backend
    employeeName,
    employeeId,
    employeeCompany,

    // Workspace state
    blurTarget,
    dialog,
    setDialog,

    activeDocument,
    activeTask,

    query,
    setQuery,
    go,

    // Leave
    leaveTypes,
    leaveType,
    setLeaveType,

    from,
    setFrom,
    to,
    setTo,
    reason,
    setReason,

    leaveLoading,
    leaveSaving,
    leaveError,
    leaveBalance,

    formError,
    setFormError,

    submitLeave,
    confirmCancelLeave,
  } = useEmployeeWorkspace();

  // ===================================================
  // 1. CANCEL LEAVE CONFIRMATION
  // ===================================================

  if (dialog === "cancelLeave") {
    const dismiss = () => {
      if (!leaveSaving) {
        setDialog(null);
      }
    };

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={dismiss}
      >
        <View
          style={[
            s.documentOverlay,
            {
              paddingBottom: Math.max(
                insets.bottom,
                10,
              ),
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={35}
            tint="light"
            blurMethod="dimezisBlurView"
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close cancellation confirmation"
            disabled={leaveSaving}
            onPress={dismiss}
            style={s.documentBackdrop}
          />

          <View
            accessibilityViewIsModal
            style={s.documentSheet}
          >
            <View style={s.documentHandle} />

            <View style={s.between}>
              <Text
                accessibilityRole="header"
                style={s.documentSheetTitle}
              >
                Cancel this leave request?
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                disabled={leaveSaving}
                onPress={dismiss}
                style={s.documentSheetClose}
              >
                <Text style={s.closeText}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={
                s.leaveConfirmationContent
              }
            >
              <Text style={s.leaveSubtitle}>
                This pending leave request
                will be cancelled in BranchSuite.
              </Text>

              <Text
                style={[
                  s.small,
                  { marginTop: 8 },
                ]}
              >
                Your available balance
                will be recalculated after
                the cancellation succeeds.
              </Text>

              <View
                style={s.leaveConfirmationActions}
              >
                <Pressable
                  accessibilityRole="button"
                  disabled={leaveSaving}
                  onPress={dismiss}
                  style={({ pressed }) => [
                    s.flex,
                    s.leaveConfirmationCancel,
                    (pressed || leaveSaving) && {
                      opacity: 0.65,
                    },
                  ]}
                >
                  <Text style={s.leaveCancelText}>
                    Keep request
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: leaveSaving,
                    busy: leaveSaving,
                  }}
                  disabled={leaveSaving}
                  onPress={() => {
                    void confirmCancelLeave();
                  }}
                  style={({ pressed }) => [
                    s.flex,
                    s.documentSave,
                    (pressed || leaveSaving) && {
                      opacity: 0.65,
                    },
                  ]}
                >
                  <Text style={s.buttonText}>
                    {leaveSaving
                      ? "Cancelling..."
                      : "Confirm cancellation"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ===================================================
  // 2. EMPLOYEE DOCUMENT PREVIEW
  // ===================================================

  if (dialog === "document" && activeDocument) {
    const closeDocument = () => {
      setDocumentError("");
      setDialog(null);
    };

    const identity = [
      employeeName,
      employeeId,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={closeDocument}
      >
        <View
          style={[
            s.documentOverlay,
            {
              paddingBottom: Math.max(
                insets.bottom,
                10,
              ),
              paddingTop: insets.top + 10,
            },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={35}
            tint="light"
            blurMethod="dimezisBlurView"
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close document preview"
            onPress={closeDocument}
            style={s.documentBackdrop}
          />

          <View
            accessibilityViewIsModal
            style={s.documentSheet}
          >
            <View style={s.documentHandle} />

            <View style={s.between}>
              <Text
                accessibilityRole="header"
                style={s.documentSheetTitle}
              >
                {activeDocument.title}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={closeDocument}
                style={s.documentSheetClose}
              >
                <Text style={s.closeText}>
                  ×
                </Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                s.documentSheetContent
              }
            >
              <Text style={s.documentEmployee}>
                {identity || "Employee"}
              </Text>

              <Text style={s.small}>
                {employeeCompany}
              </Text>

              <View style={s.documentNotice}>
                <View
                  accessibilityElementsHidden
                  style={s.documentNoticeIcon}
                >
                  <Text
                    style={s.documentNoticeIconText}
                  >
                    i
                  </Text>
                </View>

                <Text style={s.documentNoticeText}>
                  This document comes from
                  local workspace records.
                  It has not been verified
                  against backend employment
                  or document records.
                </Text>
              </View>

              <View
                style={{
                  marginTop: 16,
                  gap: 8,
                }}
              >
                <Text style={s.cardTitle}>
                  Document content
                </Text>

                <Text
                  selectable
                  style={s.body}
                >
                  {activeDocument.content}
                </Text>
              </View>

              {!!documentError && (
                <Text
                  accessibilityRole="alert"
                  style={s.error}
                >
                  {documentError}
                </Text>
              )}

              <Text
                style={[
                  s.localHint,
                  { marginTop: 14 },
                ]}
              >
                PDF export will be
                re-enabled after verified
                document integration.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ===================================================
  // 3. GENERAL WORKSPACE DIALOG
  // ===================================================

  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!leaveSaving) {
          setDialog(null);
        }
      }}
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
      >
        <View style={s.modal}>
          {/* HEADER */}

          <View style={s.between}>
            <Text
              accessibilityRole="header"
              style={s.sectionTitle}
            >
              {dialog === "leave"
                ? "Apply for leave"
                : dialog === "task"
                  ? "Task progress"
                  : dialog === "search"
                    ? "Find a module"
                    : "My payslip"}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              disabled={
                dialog === "leave" &&
                leaveSaving
              }
              onPress={() => setDialog(null)}
              style={s.close}
            >
              <Text style={s.closeText}>
                ×
              </Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
          >
            {/* ===================================== */}
            {/* LEAVE APPLICATION */}
            {/* ===================================== */}

            {dialog === "leave" && (
              <>
                <Text
                  style={[
                    s.small,
                    {
                      marginTop: 12,
                      marginBottom: 12,
                    },
                  ]}
                >
                  Select a leave type and enter
                  your requested dates.
                </Text>

                <View
                  style={[
                    s.chips,
                    {
                      flexWrap: "wrap",
                    },
                  ]}
                >
                  {leaveTypes.map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected:
                          entry.name === leaveType,
                        disabled:
                          leaveSaving,
                      }}
                      disabled={leaveSaving}
                      style={[
                        s.chip,
                        entry.name === leaveType &&
                          s.chipSelected,
                      ]}
                      onPress={() => {
                        setLeaveType(entry.name);
                        setFormError("");
                      }}
                    >
                      <Text style={s.body}>
                        {entry.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {leaveTypes.length === 0 && (
                  <Text style={s.error}>
                    No active leave types
                    are available.
                  </Text>
                )}

                <Field
                  label="From (YYYY-MM-DD)"
                  value={from}
                  onChange={setFrom}
                />

                <Field
                  label="To (YYYY-MM-DD)"
                  value={to}
                  onChange={setTo}
                />

                <Field
                  label="Reason"
                  value={reason}
                  onChange={setReason}
                  multiline
                />

                {/* SELECTED LEAVE BALANCE */}

                <View
                  style={[
                    s.card,
                    {
                      marginBottom: 14,
                    },
                  ]}
                >
                  <Text style={s.small}>
                    Estimated available balance
                  </Text>

                  <Text
                    style={[
                      s.cardTitle,
                      {
                        marginTop: 5,
                      },
                    ]}
                  >
                    {formatBalance(
                      leaveBalance(leaveType),
                    )}
                  </Text>

                  <Text
                    style={[
                      s.small,
                      {
                        marginTop: 6,
                      },
                    ]}
                  >
                    Actual leave eligibility
                    depends on the company's
                    configured leave policy.
                  </Text>
                </View>

                {!!leaveError && (
                  <Text
                    accessibilityRole="alert"
                    style={s.error}
                  >
                    {leaveError}
                  </Text>
                )}

                {!!formError && (
                  <Text
                    accessibilityRole="alert"
                    style={s.error}
                  >
                    {formError}
                  </Text>
                )}

                <Button
                  label={
                    leaveSaving
                      ? "Submitting..."
                      : "Submit leave request"
                  }
                  disabled={
                    leaveSaving ||
                    leaveLoading ||
                    !!leaveError ||
                    leaveTypes.length === 0
                  }
                  onPress={() => {
                    void submitLeave();
                  }}
                />

                <Text
                  style={[
                    s.small,
                    {
                      marginTop: 12,
                      marginBottom: 16,
                    },
                  ]}
                >
                  Your request will be sent
                  to BranchSuite for review.
                  It is not approved automatically.
                </Text>
              </>
            )}

            {/* ===================================== */}
            {/* TASK MANAGEMENT */}
            {/* ===================================== */}

            {dialog === "task" && (
              <>
                {!!activeTask && (
                  <>
                    <Text
                      style={[
                        s.cardTitle,
                        {
                          marginTop: 15,
                        },
                      ]}
                    >
                      {activeTask.title}
                    </Text>

                    <Text
                      style={[
                        s.small,
                        {
                          marginTop: 8,
                          marginBottom: 16,
                        },
                      ]}
                    >
                      {displayDate(
                        activeTask.date,
                      )}
                      {" · "}
                      {activeTask.time}
                    </Text>
                  </>
                )}

                <View
                  style={[
                    s.card,
                    {
                      marginTop: 12,
                      marginBottom: 15,
                    },
                  ]}
                >
                  <Text style={s.cardTitle}>
                    Update your assigned tasks
                  </Text>

                  <Text
                    style={[
                      s.body,
                      {
                        marginTop: 8,
                      },
                    ]}
                  >
                    Task progress is managed
                    through the live Task
                    Management screen.
                    Changes made there are
                    sent to the backend and
                    can be reviewed by Admin.
                  </Text>
                </View>

                <Button
                  label="Open my tasks"
                  onPress={() => {
                    setDialog(null);
                    go("tasks");
                  }}
                />
              </>
            )}

            {/* ===================================== */}
            {/* PAYSLIP */}
            {/* ===================================== */}

            {dialog === "payslip" && (
              <>
                <Text
                  style={[
                    s.cardTitle,
                    {
                      marginTop: 15,
                    },
                  ]}
                >
                  Payslip information
                </Text>

                <Text
                  style={[
                    s.body,
                    {
                      marginTop: 12,
                    },
                  ]}
                >
                  No verified payslip is
                  available in this dialog.
                  Payroll details will appear
                  when the employee-authorized
                  backend payslip integration
                  is completed.
                </Text>

                <Button
                  label="Open my payroll"
                  onPress={() => {
                    setDialog(null);
                    go("payroll");
                  }}
                />
              </>
            )}

            {/* ===================================== */}
            {/* WORKSPACE SEARCH */}
            {/* ===================================== */}

            {dialog === "search" && (
              <>
                <Field
                  label="Search workspace"
                  value={query}
                  onChange={setQuery}
                  placeholder="Attendance, tasks, payroll..."
                />

                {navigation
                  .filter((item) =>
                    item.label
                      .toLowerCase()
                      .includes(
                        query.toLowerCase(),
                      ),
                  )
                  .map((item) => (
                    <Tile
                      key={item.page}
                      title={item.label}
                      description="Open workspace"
                      symbol={item.symbol}
                      onPress={() => go(item.page)}
                    />
                  ))}

                {!navigation.some((item) =>
                  item.label
                    .toLowerCase()
                    .includes(
                      query.toLowerCase(),
                    ),
                ) && (
                  <Text style={s.small}>
                    No matching modules.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
