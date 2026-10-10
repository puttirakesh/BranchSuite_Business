import { Pressable, Text, View } from 'react-native';
import { documentDate, employee, leaveDays } from '../../../src/features/employee/data';
import { WorkspaceIcon } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function LeaveScreen() {
  const { records, loaded, leaveBalance, openLeave, openCancelLeave } = useEmployeeWorkspace();
  return (
    <View style={s.leavePage}>
      <View>
        <View style={s.between}>
          <View style={s.flex}>
            <Text style={s.leaveEyebrow}>5 GEN WORKSPACE</Text>
            <Text accessibilityRole="header" style={s.leaveTitle}>My leave</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Apply for leave" accessibilityState={{ disabled: !loaded }} disabled={!loaded} onPress={openLeave} style={({ pressed }) => [s.leaveApply, (pressed || !loaded) && { opacity: 0.65 }]}>
            <Text style={s.buttonText}>+ Apply</Text>
          </Pressable>
        </View>
        <Text style={s.leaveSubtitle}>Take time off with a clear view of your balance.</Text>
      </View>
      <View style={s.leaveBalances}>
        {['Casual leave', 'Sick leave'].map((type) => (
          <View key={type} style={s.leaveBalanceCard}>
            <View style={s.row}>
              <WorkspaceIcon symbol="calendar" size={18} />
              <Text style={s.leaveBalanceLabel}>{type}</Text>
            </View>
            <Text style={s.leaveBalanceValue}>{leaveBalance(type)} days</Text>
            <Text style={s.leaveBalanceHint}>Available balance</Text>
          </View>
        ))}
      </View>
      <View style={s.leaveNotice}>
        <View accessibilityElementsHidden style={s.documentNoticeIcon}><Text style={s.documentNoticeIconText}>i</Text></View>
        <Text style={s.leaveNoticeText}>Pending requests reserve your available balance. Approved requests deduct days. Cancelling a pending request releases the reservation.</Text>
      </View>
      <View style={s.leaveRequests}>
        <Text accessibilityRole="header" style={s.leaveRequestsTitle}>My requests</Text>
        {records.leaves.length ? records.leaves.map((request) => {
          const days = leaveDays(request.from, request.to);
          return (
            <View style={s.leaveRequestCard} key={request.id}>
              <View style={[s.between, { alignItems: 'flex-start' }]}>
                <View style={[s.row, s.flex]}>
                  <View style={s.leaveRequestAvatar}><Text style={s.leaveRequestInitials}>AR</Text></View>
                  <View style={s.flex}>
                    <Text style={s.leaveEmployeeName}>{employee.name}</Text>
                    <Text style={s.leaveRequestType}>{request.type}</Text>
                  </View>
                </View>
                <View style={[s.leaveStatus, request.status === 'Approved' && s.leaveStatusApproved, request.status === 'Cancelled' && s.leaveStatusCancelled]}>
                  <Text style={[s.leaveStatusText, request.status === 'Approved' && { color: '#217663' }, request.status === 'Cancelled' && { color: '#5F7088' }]}>{request.status}</Text>
                </View>
              </View>
              <Text style={s.leaveRequestDates}>{documentDate(request.from)}{' \u2013 '}{documentDate(request.to)}{' \u00B7 '}{days} {days === 1 ? 'day' : 'days'}</Text>
              <Text style={s.leaveRequestReason}>{request.reason}</Text>
              {request.status === 'Pending' && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Cancel ${request.type} request for ${documentDate(request.from)}`} onPress={() => openCancelLeave(request.id)} style={({ pressed }) => [s.leaveCancel, pressed && { opacity: 0.65 }]}>
                  <Text style={s.leaveCancelText}>Cancel request</Text>
                </Pressable>
              )}
            </View>
          );
        }) : (
          <View style={s.leaveRequestCard}>
            <Text style={s.leaveEmployeeName}>No leave requests yet</Text>
            <Text style={s.leaveRequestReason}>Your submitted requests and their status appear here.</Text>
          </View>
        )}
      </View>
    </View>
  );
}
