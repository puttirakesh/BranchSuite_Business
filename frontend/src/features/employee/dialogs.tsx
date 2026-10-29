import { KeyboardAwareScrollView as ScrollView } from '../../ui/KeyboardAwareScrollView';
import { useToastState } from '../../ui/useToastState';
import { AppIcon } from "../../ui/AppIcon";
import { WorkspaceSearchDialog } from '../../ui/WorkspaceSearchDialog';

import React, { useState } from "react";
import { useRouter, type Href } from 'expo-router';
import { employeeDestinations, filterDestinations } from '../../ui/workspace-navigation';

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ToastModal as Modal } from '../../ui/Toast';

import { BlurView } from "expo-blur";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  displayDate,
} from "./data";

import {
  Button,
} from "./components";

import { useEmployeeStyles } from "./styles";
import { saveDocumentPdf } from './document-pdf';

import {
  useEmployeeWorkspace,
} from "./workspace";

// =====================================================
// HELPERS
// =====================================================

function documentParagraphs(content: string) {
  return content
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

// =====================================================
// EMPLOYEE DIALOGS
// =====================================================

export function EmployeeDialogs() {
  const s = useEmployeeStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [documentError, setDocumentError] =
    useToastState("", 'error');
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


    leaveSaving,


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
    const paragraphs = documentParagraphs(activeDocument.content);
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

              <View style={s.documentPaper}>
                <Text style={s.documentContentLabel}>DOCUMENT CONTENT</Text>
                <View style={s.documentParagraphs}>
                  {paragraphs.map((paragraph, index) => <Text key={index} selectable style={s.documentContentText}>{paragraph}</Text>)}
                </View>
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

  if (dialog === 'search') {
    return <WorkspaceSearchDialog visible query={query} onChangeQuery={setQuery} results={searchResults}
      onClose={() => setDialog(null)}
      onSelect={item => { setDialog(null); router.push(item.href as Href); }} />;
  }

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
      <View
        style={s.overlay}

      >
        <View style={s.modal}>
          {/* HEADER */}

          <View style={s.between}>
            <Text
              accessibilityRole="header"
              style={s.sectionTitle}
            >
              {dialog === "task"
                  ? "Task progress"
                  : "My payslip"}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dialog"
              disabled={leaveSaving}
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
                  View your published salary history, earnings, deductions, and payment details in My payroll. You can download a PDF for each available month.
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

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
