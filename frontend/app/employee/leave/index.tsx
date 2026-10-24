import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { apiErrorMessage } from '../../../src/core/admin/http';
import { leaveApi } from '../../../src/core/admin/api';
import { Badge, RefreshButton } from '../../../src/features/employee/components';
import { AttendanceAction, attendanceUI as ui } from '../../../src/features/employee/AttendanceUI';
import { documentDate } from '../../../src/features/employee/data';
import { useEmployeeStyles } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

const statuses = ['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'] as const;
type StatusFilter = typeof statuses[number];

export default function LeaveScreen() {
  const s = useEmployeeStyles();
  const {
    selectedProfileId, employeeProfile, leaveTypes, leaveRequests, leaveLoading, leaveSaving,
    leaveError, leaveBalance, pendingLeaveDays, canCancelLeaveRequest, openLeave, refreshLeave, go,
  } = useEmployeeWorkspace();
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const scope = useRef(selectedProfileId);
  scope.current = selectedProfileId;
  useEffect(() => {
    setFilter('All'); setCancelId(null); setCancelError(''); setNotice('');
  }, [selectedProfileId]);
  const canApply = !!employeeProfile && !leaveLoading && !leaveSaving && !cancelling && !leaveError && leaveTypes.length > 0;
  const selectedRequest = leaveRequests.find(item => item.id === cancelId);
  const refundsPaidDays = selectedRequest?.status === 'APPROVED' && (selectedRequest.leaveType?.isPaid ?? leaveTypes.find(item => item.id === selectedRequest.leaveTypeId)?.isPaid);
  const visible = [...leaveRequests]
    .filter(item => filter === 'All' || item.status === filter.toUpperCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const count = (value: StatusFilter) => leaveRequests.filter(item => value === 'All' || item.status === value.toUpperCase()).length;
  const closeCancellation = () => { if (!busy.current) { setCancelId(null); setCancelError(''); } };
  const confirmCancellation = async () => {
    if (busy.current || leaveSaving || leaveLoading || !selectedRequest) return;
    if (!canCancelLeaveRequest(selectedRequest)) { setCancelError('This request is no longer eligible for cancellation.'); return; }
    const requestScope = selectedProfileId;
    busy.current = true; setCancelling(true); setCancelError(''); setNotice('');
    try {
      await leaveApi.cancel(selectedRequest.id);
      if (scope.current === requestScope) { setCancelId(null); setNotice('Leave request cancelled.'); }
    } catch (error) {
      if (scope.current === requestScope) setCancelError(apiErrorMessage(error, 'Unable to cancel leave request.'));
    } finally {
      refreshLeave(); busy.current = false; setCancelling(false);
    }
  };

  return <View style={[ui.page, { gap: 16 }]}>
    <AdminPageHeading title="My leave" onBack={() => go('home')} backDisabled={cancelling || leaveSaving}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Apply for leave" accessibilityState={{ disabled: !canApply }} disabled={!canApply}
          onPress={openLeave} style={({ pressed }) => [styles.apply, (pressed || !canApply) && { opacity: 0.55 }]}>
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
        <RefreshButton iconOnly label="Refresh leave requests" loading={leaveLoading} disabled={cancelling || leaveSaving} onPress={refreshLeave} />
      </View>
    </AdminPageHeading>
    {!!notice && <View style={ui.success}><Text accessibilityRole="alert" style={s.body}>{notice}</Text></View>}
    {leaveLoading && <View style={[s.card, ui.empty]}><ActivityIndicator accessibilityLabel="Loading leave information" /><Text style={s.small}>Loading your leave…</Text></View>}
    {!!leaveError && !leaveLoading && <View style={[ui.error, { gap: 6 }]}>
      <Text style={ui.sectionHeading}>Leave information unavailable</Text>
      <Text accessibilityRole="alert" style={s.error}>{leaveError}</Text>
      <Text style={s.small}>Use Refresh in the page header to try again.</Text>
    </View>}
    {!!leaveTypes.length && <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={ui.sectionHeading}>Leave balances</Text>
      <View style={styles.balances}>
        {leaveTypes.map(entry => {
          const balance = leaveBalance(entry.name);
          const pending = pendingLeaveDays(entry.name);
          return <View key={entry.id} style={[s.card, styles.balance]}>
            <Text style={ui.sectionHeading}>{entry.name}</Text>
            <Text style={s.small}>{entry.isPaid ? 'Paid leave' : 'Unpaid leave'}</Text>
            <View style={{ gap: 3 }}>
              <Text style={styles.balanceValue}>{leaveLoading || leaveError ? '—' : balance === null ? 'Not allocated' : `${balance} days`}</Text>
              <Text style={ui.caption}>Available balance</Text>
            </View>
            <Text style={ui.caption}>{leaveLoading || leaveError ? 'Pending balance unavailable' : `${pending} ${pending === 1 ? 'day' : 'days'} pending`}</Text>
          </View>;
        })}
      </View>
    </View>}
    {!leaveLoading && !leaveError && !leaveTypes.length && <View style={[s.card, ui.empty]}>
      <Text style={ui.sectionHeading}>No leave types available</Text>
      <Text style={ui.emptyText}>Contact your administrator to set up leave.</Text>
    </View>}
    <View style={{ gap: 12 }}>
      <View style={s.between}><Text accessibilityRole="header" style={ui.sectionHeading}>My requests</Text><Text style={ui.caption}>{visible.length} of {leaveRequests.length}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {statuses.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} leave requests`}
          accessibilityState={{ selected: filter === value }} aria-pressed={filter === value} onPress={() => setFilter(value)}
          style={({ pressed }) => [styles.filter, filter === value && styles.filterSelected, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.filterText, filter === value && styles.selectedText]}>{value} {count(value)}</Text>
        </Pressable>)}
      </View>
      {visible.map(request => {
        const type = leaveTypes.find(item => item.id === request.leaveTypeId)?.name ?? request.leaveType?.name ?? 'Leave';
        const days = Number(request.days);
        const start = request.startDate.slice(0, 10), end = request.endDate.slice(0, 10);
        return <View key={request.id} style={[s.card, { gap: 12 }]}>
          <View style={[s.between, { gap: 8, flexWrap: 'wrap' }]}>
            <Text style={[ui.sectionHeading, { flexShrink: 1 }]}>{type}</Text>
            <Badge label={request.status} />
          </View>
          <View style={ui.info}>
            <Text style={s.body}>{documentDate(start)}{start !== end ? ` – ${documentDate(end)}` : ''}</Text>
            <Text style={ui.caption}>{days} calendar {days === 1 ? 'day' : 'days'}</Text>
          </View>
          <Text style={s.body}>{request.reason}</Text>
          {!!request.reportingTo && <Text style={s.small}>Reporting to: {request.reportingTo.name}</Text>}
          {!!request.reviewNote && <View style={ui.info}><Text style={ui.caption}>Review note</Text><Text style={s.body}>{request.reviewNote}</Text></View>}
          {canCancelLeaveRequest(request) && <View style={[ui.divider, { alignItems: 'flex-start' }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${type} request`} disabled={cancelling || leaveSaving || leaveLoading}
              accessibilityState={{ disabled: cancelling || leaveSaving || leaveLoading }}
              onPress={() => { if (!busy.current) { setCancelError(''); setCancelId(request.id); } }}
              style={({ pressed }) => [ui.action, ui.dangerAction, (pressed || cancelling || leaveSaving || leaveLoading) && { opacity: 0.55 }]}>
              <Text style={[ui.actionText, { color: '#A33148' }]}>Cancel request</Text>
            </Pressable>
          </View>}
        </View>;
      })}
      {!visible.length && !leaveLoading && !leaveError && <View style={[s.card, ui.empty]}>
        <Text style={ui.sectionHeading}>{filter === 'All' ? 'No leave requests yet' : `No ${filter.toLowerCase()} requests`}</Text>
        <Text style={ui.emptyText}>{filter === 'All' ? 'Use Apply to request leave.' : 'Choose another status to see your requests.'}</Text>
      </View>}
    </View>
    <Modal transparent visible={cancelId !== null} animationType="fade" onRequestClose={closeCancellation}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>Cancel leave request?</Text>
            {!!selectedRequest && <View style={ui.info}>
              <Text style={s.body}>{documentDate(selectedRequest.startDate.slice(0, 10))} – {documentDate(selectedRequest.endDate.slice(0, 10))}</Text>
              <Text style={ui.caption}>{selectedRequest.days} {Number(selectedRequest.days) === 1 ? 'day' : 'days'}</Text>
            </View>}
            <Text style={s.small}>{refundsPaidDays ? 'Approved paid leave days will return to your balance.' : 'This request will be marked as cancelled.'}</Text>
            {!!cancelError && <Text accessibilityRole="alert" style={s.error}>{cancelError}</Text>}
            <AttendanceAction label={cancelling ? 'Cancelling…' : 'Confirm cancellation'} danger loading={cancelling} disabled={cancelling || leaveLoading || leaveSaving || !selectedRequest} onPress={() => { void confirmCancellation(); }} />
            <AttendanceAction label="Keep request" secondary disabled={cancelling} onPress={closeCancellation} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  apply: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#345CF2', alignItems: 'center', justifyContent: 'center' },
  applyText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: '#FFFFFF' },
  balances: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  balance: { flexGrow: 1, flexBasis: 150, minWidth: 130, gap: 8 },
  balanceValue: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: '#20334F' },
  filter: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE3ED', justifyContent: 'center' },
  filterSelected: { borderColor: '#345CF2', backgroundColor: '#EAF0FF' },
  filterText: { fontSize: 12, lineHeight: 18, color: '#607591', fontWeight: '500' },
  selectedText: { color: '#345CF2', fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(16,30,45,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  dialogTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#20334F' },
});
