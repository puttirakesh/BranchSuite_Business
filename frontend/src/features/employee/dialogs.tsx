import { AppIcon } from "../../ui/AppIcon";

import React, { useState } from "react";
import { useRouter, type Href } from 'expo-router';
import { employeeDestinations, filterDestinations } from '../../ui/workspace-navigation';

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
  displayDate,
  dayKey,
  leaveDays,
} from "./data";

import {
  Button,
  Tile,
  Field,
} from "./components";

import { useEmployeeStyles } from "./styles";
import { DatePickerField } from "../../ui/DatePickerField";
import { saveDocumentPdf } from './document-pdf';

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
  const s = useEmployeeStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [documentError, setDocumentError] =
    useState("");
  const [documentSaving, setDocumentSaving] = useState(false);

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
  const searchResults = filterDestinations(employeeDestinations, query);

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
                Cancel this leave request
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                disabled={leaveSaving}
                onPress={dismiss}
                style={s.documentSheetClose}
              >
                <AppIcon symbol="×" style={s.closeText} />
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
      if (documentSaving) return;
      setDocumentError("");
      setDialog(null);
    };

    const identity = [
      employeeName,
      activeDocument.employeeCode ?? employeeId,
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
                <AppIcon symbol="×" style={s.closeText} />
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
                  {activeDocument.companyName ?? employeeCompany}
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
                  {activeDocument.source === 'server' ? 'Issued by your HR team and loaded from your company account.' : 'This document has not been verified against your company records.'}
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

              {activeDocument.source === 'server' && <Button label={documentSaving ? 'Preparing PDF…' : 'Download PDF'} disabled={documentSaving} onPress={() => {
                if (documentSaving) return;
                setDocumentSaving(true); setDocumentError('');
                void saveDocumentPdf({ document: activeDocument, employee: { name: employeeName, employeeId: activeDocument.employeeCode ?? employeeId, company: activeDocument.companyName ?? employeeCompany }, sourceVerified: true })
                  .catch(error => setDocumentError(error instanceof Error ? error.message : 'Could not save the document.'))
                  .finally(() => setDocumentSaving(false));
              }} />}
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
      <KeyboardAvoidingView enabled={Platform.OS === 'ios'}
        style={s.overlay}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
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
              <AppIcon symbol="×" style={s.closeText} />
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

                <View style={s.field}>
                  <Text style={s.label}>From</Text>
                  <DatePickerField hideLabel label="Leave start date" value={from} onChange={value => {
                    setFrom(value);
                    if (to < value || to.slice(0, 4) !== value.slice(0, 4)) setTo(value);
                    setFormError('');
                  }} minDate={dayKey()} disabled={leaveSaving} />
                </View>

                <View style={s.field}>
                  <Text style={s.label}>To</Text>
                  <DatePickerField hideLabel label="Leave end date" value={to} onChange={value => { setTo(value); setFormError(''); }} minDate={from || dayKey()} maxDate={`${(from || dayKey()).slice(0, 4)}-12-31`} disabled={leaveSaving} />
                </View>

                <Text accessibilityLiveRegion="polite" style={s.small}>{leaveDays(from, to)} calendar {leaveDays(from, to) === 1 ? 'day' : 'days'} requested. Requests spanning two years must be submitted separately.</Text>

                <Field validation={{ required: true }}
                  label="Reason"
                  value={reason}
                  onChange={value => { setReason(value); setFormError(''); }}
                  editable={!leaveSaving}
                  maxLength={2000}
                  hint={`${reason.trim().length}/2000 characters`}
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
                <Field validation={{ kind: 'search', maxLength: 100 }}
                  label="Search workspace"
                  value={query}
                  onChange={setQuery}
                />

                {searchResults.map((item) => (
                    <Tile
                      key={item.href}
                      title={item.label}
                      description={item.group}
                      symbol={item.icon}
                      onPress={() => { setDialog(null); router.push(item.href as Href); }}
                    />
                  ))}

                {!searchResults.length && (
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
