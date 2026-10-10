import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { employee, navigation, displayDate, money } from './data';
import { Button, Badge, Tile, Field } from './components';
import { s } from './styles';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { documentPdfFilename, sampleDocumentNotice, saveDocumentPdf } from './document-pdf';
import { useEmployeeWorkspace } from './workspace';

export function EmployeeDialogs() {
  const insets = useSafeAreaInsets();
  const [documentError, setDocumentError] = useState('');
  const { confirmCancelLeave, blurTarget, setRecords, setMessage, dialog, setDialog, activeDocument, savingDocument, setSavingDocument, activeTask, taskStatus, setTaskStatus, taskNote, setTaskNote, query, setQuery, leaveType, setLeaveType, from, setFrom, to, setTo, reason, setReason, formError, setFormError, go, leaveBalance, submitLeave } = useEmployeeWorkspace();
  if (dialog === 'cancelLeave') {
    const dismiss = () => setDialog(null);
    return (
      <Modal visible transparent animationType="slide" onRequestClose={dismiss}>
        <View style={[s.documentOverlay, { paddingBottom: Math.max(insets.bottom, 10), paddingTop: insets.top + 10 }]}>
          <BlurView pointerEvents="none" intensity={35} tint="light" blurMethod="dimezisBlurView" blurTarget={blurTarget} style={StyleSheet.absoluteFill} />
          <Pressable accessibilityRole="button" accessibilityLabel="Close cancellation confirmation" onPress={dismiss} style={s.documentBackdrop} />
          <View accessibilityViewIsModal style={s.documentSheet}>
            <View style={s.documentHandle} />
            <View style={s.between}>
              <Text accessibilityRole="header" style={s.documentSheetTitle}>Cancel this request?</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={dismiss} style={s.documentSheetClose}>
                <Text style={s.closeText}>{'\u00D7'}</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.leaveConfirmationContent}>
              <Text style={s.leaveSubtitle}>The pending request will be marked cancelled.</Text>
              <View style={s.leaveConfirmationActions}>
                <Pressable accessibilityRole="button" onPress={dismiss} style={({ pressed }) => [s.flex, s.leaveConfirmationCancel, pressed && { opacity: 0.65 }]}>
                  <Text style={s.leaveCancelText}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={confirmCancelLeave} style={({ pressed }) => [s.flex, s.documentSave, pressed && { opacity: 0.65 }]}>
                  <Text style={s.buttonText}>Confirm</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
  if (dialog === 'document' && activeDocument) {
    const closeDocument = () => { setDocumentError(''); setDialog(null); };
    return (
      <Modal visible transparent animationType="slide" onRequestClose={closeDocument}>
        <View style={[s.documentOverlay, { paddingBottom: Math.max(insets.bottom, 10), paddingTop: insets.top + 10 }]}>
          <BlurView pointerEvents="none" intensity={35} tint="light" blurMethod="dimezisBlurView" blurTarget={blurTarget} style={StyleSheet.absoluteFill} />
          <Pressable accessibilityRole="button" accessibilityLabel="Close document preview" onPress={closeDocument} style={s.documentBackdrop} />
          <View accessibilityViewIsModal style={s.documentSheet}>
            <View style={s.documentHandle} />
            <View style={s.between}>
              <Text accessibilityRole="header" style={s.documentSheetTitle}>{activeDocument.title}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={closeDocument} style={s.documentSheetClose}>
                <Text style={s.closeText}>{'\u00D7'}</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.documentSheetContent}>
              <Text style={s.documentEmployee}>{employee.name}{' \u00B7 '}{employee.id}</Text>
              <View style={s.documentNotice}>
                <View accessibilityElementsHidden style={s.documentNoticeIcon}><Text style={s.documentNoticeIconText}>i</Text></View>
                <Text style={s.documentNoticeText}>{sampleDocumentNotice}</Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text style={s.small}>Save as</Text>
                <Text selectable style={s.body}>{documentPdfFilename(activeDocument)}</Text>
              </View>
              {!!documentError && <Text accessibilityRole="alert" style={s.error}>{documentError}</Text>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: savingDocument, busy: savingDocument }} disabled={savingDocument} style={({ pressed }) => [s.documentSave, (pressed || savingDocument) && { opacity: 0.65 }]} onPress={async () => {
                setDocumentError('');
                setSavingDocument(true);
                try {
                  await saveDocumentPdf(activeDocument);
                } catch {
                  setDocumentError('Could not export the PDF. Please try again.');
                } finally { setSavingDocument(false); }
              }}>
                <Text style={s.buttonText}>{savingDocument ? 'Preparing PDF\u2026' : 'Save sample document PDF'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
  return (
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.modal}>
            <View style={s.between}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                {dialog === "leave"
                  ? "Apply for leave"
                  : dialog === "task"
                    ? "Update task"
                    : dialog === "search"
                      ? "Find a module"
                      : "September 2026 payslip"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={() => setDialog(null)}
                style={s.close}
              >
                <Text style={s.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {dialog === "leave" && (
                <>
                  <View style={s.chips}>
                    {["Casual leave", "Sick leave"].map((value) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: value === leaveType }}
                        key={value}
                        style={[s.chip, value === leaveType && s.chipSelected]}
                        onPress={() => setLeaveType(value)}
                      >
                        <Text style={s.body}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Field
                    label="From (YYYY-MM-DD)"
                    value={from}
                    onChange={setFrom}
                  />
                  <Field label="To (YYYY-MM-DD)" value={to} onChange={setTo} />
                  <Field
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    multiline
                  />
                  <Text style={[s.small, { marginBottom: 16 }]}>
                    Casual: {leaveBalance("Casual leave")} days · Sick:{" "}
                    {leaveBalance("Sick leave")} days. Calendar days are used in
                    this demo.
                  </Text>
                  <Text style={[s.small, { marginBottom: 16 }]}>
                    This request is saved on this device for the demo.
                  </Text>
                  {!!formError && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {formError}
                    </Text>
                  )}
                  <Button label="Submit leave request" onPress={submitLeave} />
                </>
              )}
              {dialog === "task" && activeTask && (
                <>
                  <Text style={[s.cardTitle, { marginVertical: 15 }]}>
                    {activeTask.title}
                  </Text>
                  <Text style={s.small}>
                    {displayDate(activeTask.date)} · {activeTask.time} ·
                    Assigned by Business Admin
                  </Text>
                  <View style={[s.chips, { flexWrap: "wrap", marginTop: 18 }]}>
                    {(["Open", "In progress", "Completed"] as const).map(
                      (value) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: value === taskStatus,
                          }}
                          key={value}
                          style={[
                            s.chip,
                            taskStatus === value && s.chipSelected,
                          ]}
                          onPress={() => setTaskStatus(value)}
                        >
                          <Text style={s.body}>{value}</Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <Field
                    label="Progress / completion note"
                    value={taskNote}
                    onChange={setTaskNote}
                    multiline
                  />
                  {!!formError && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {formError}
                    </Text>
                  )}
                  <Button
                    label="Save update"
                    onPress={() => {
                      if (taskStatus === "Completed" && !taskNote.trim()) {
                        setFormError(
                          "Add a completion note before marking this task completed.",
                        );
                        return;
                      }
                      setRecords((r) => ({
                        ...r,
                        tasks: r.tasks.map((t) =>
                          t.id === activeTask.id
                            ? {
                                ...t,
                                status: taskStatus,
                                note: taskNote.trim(),
                              }
                            : t,
                        ),
                      }));
                      setDialog(null);
                      setMessage("Task update saved.");
                    }}
                  />
                </>
              )}
              {dialog === "payslip" && (
                <>
                  <Text style={[s.eyebrow, { marginTop: 20 }]}>
                    EMPLOYEE PAYSLIP
                  </Text>
                  <Text style={[s.sectionTitle, { marginTop: 10 }]}>
                    {employee.company}
                  </Text>
                  <Text style={s.subtitle}>
                    {employee.name} · {employee.id}
                  </Text>
                  <Badge label="Paid" />
                  <View style={s.divider} />
                  <Text style={s.sectionTitle}>Earnings</Text>
                  {[
                    ["Basic salary", 24300],
                    ["House rent allowance", 12150],
                    ["Special allowance", 8550],
                    ["Gross earnings", 45000],
                    ["Retirement contribution", 1800],
                    ["Demo tax deduction", 1000],
                    ["Total deductions", 2800],
                  ].map(([label, value]) => (
                    <View style={s.moneyRow} key={label}>
                      <Text style={s.body}>{label}</Text>
                      <Text style={s.bold}>{money(Number(value))}</Text>
                    </View>
                  ))}
                  <View style={[s.moneyRow, s.total]}>
                    <Text style={s.cardTitle}>Net take-home</Text>
                    <Text style={s.cardTitle}>{money(42200)}</Text>
                  </View>
                  <Text style={s.localHint}>
                    Fictional sample payslip. Not an employment record.
                  </Text>
                </>
              )}
              {dialog === "search" && (
                <>
                  <Field
                    label="Search workspace"
                    value={query}
                    onChange={setQuery}
                    placeholder="Attendance, tasks, payroll…"
                  />
                  {navigation
                    .filter((item) =>
                      item.label.toLowerCase().includes(query.toLowerCase()),
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
                    item.label.toLowerCase().includes(query.toLowerCase()),
                  ) && <Text style={s.small}>No matching modules.</Text>}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
  );
}
