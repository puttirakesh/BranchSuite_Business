
import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from 'expo-router';

import { Text, Pressable, View } from "react-native";

import {
  useEmployeeStyles,
} from "../../../src/features/employee/styles";

import {
  useEmployeeWorkspace,
} from "../../../src/features/employee/workspace";
import { supportTicketsApi, type SupportTicketDto } from '../../../src/core/admin/workspace-records.api';
import { Field, Button, Badge } from '../../../src/features/employee/components';
import { useAuth } from '../../../src/core/auth/AuthProvider';

// =====================================================
// EMPLOYEE HELP SCREEN
// =====================================================

export default function HelpScreen() {
  const s = useEmployeeStyles();
  const { session } = useAuth();
  const {
    employeeName,
    employeeCompany,
    employeeBranch,
    employeeDepartment,
    employeeCompanyId,
    employeeBranchId,
    profileLoading,
    profileError,
  } = useEmployeeWorkspace();

  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketCategory, setTicketCategory] = useState('OTHER');
  const [ticketLoading, setTicketLoading] = useState(true);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replySaving, setReplySaving] = useState(false);
  const busy = useRef(false);
  const topics: Record<string, string> = { ACCOUNT: 'Account access issue', PAYROLL: 'Payslip or payment question', ATTENDANCE: 'Attendance record correction', CRM: 'Assigned work question', OTHER: '' };
  useFocusEffect(useCallback(() => {
    let active = true;
    setTicketLoading(true); setTicketError('');
    supportTicketsApi.mine().then(items => { if (active) setTickets(items); })
      .catch(cause => { if (active) setTicketError(cause instanceof Error ? cause.message : 'Could not load support requests.'); })
      .finally(() => { if (active) setTicketLoading(false); });
    return () => { active = false; };
  }, [employeeCompanyId, reload]));
  const submitTicket = async () => {
    if (!employeeCompanyId || !employeeBranchId || busy.current) return;
    if (ticketSubject.trim().length < 4 || ticketMessage.trim().length < 10) { setFormError('Enter a subject of at least 4 characters and at least 10 characters describing the issue.'); return; }
    busy.current = true;
    setTicketSaving(true); setFormError(''); setNotice('');
    try {
      const saved = await supportTicketsApi.create({ companyId: employeeCompanyId, branchId: employeeBranchId, category: ticketCategory, subject: ticketSubject.trim(), message: ticketMessage.trim() });
      setTickets(current => [saved, ...current]); setTicketSubject(''); setTicketMessage('');
      setNotice('Your support request was submitted.');
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Could not submit your request.'); }
    finally { busy.current = false; setTicketSaving(false); }
  };
  const sendReply = async () => {
    if (!replyId || busy.current) return;
    if (!replyMessage.trim()) { setReplyError('Enter a reply before sending.'); return; }
    busy.current = true; setReplySaving(true); setReplyError('');
    try {
      const updated = await supportTicketsApi.reply(replyId, replyMessage.trim());
      setTickets(items => items.map(item => item.id === updated.id ? updated : item));
      setReplyMessage(''); setReplyId(null); setNotice('Your reply was sent.');
    } catch (cause) { setReplyError(cause instanceof Error ? cause.message : 'Could not send your reply.'); }
    finally { busy.current = false; setReplySaving(false); }
  };

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
        "Open My Payroll to view published payslips and payment status. Contact your administrator if a pay period is missing.",
    },
    {
      title: "My documents",
      description: "Open My Documents to view employment letters and verified records issued by HR.",
    },
    {
      title: "Salary advances",
      description:
        "Open Salary Advances to submit a request, track your administrator's decision, or cancel a pending request. Your requests are saved to your company account.",
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

      <View style={[s.card, { gap: 10 }]}>
        <Text style={s.cardTitle}>Contact support</Text><Text style={s.small}>Submit a request to your company administrator. Replies and status are saved to your company account.</Text>
        {!!notice && <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
        {!employeeCompanyId || !employeeBranchId ? <Text style={s.error}>A current company and branch assignment is required to submit a support request.</Text> : <>
          <Text style={s.label}>What do you need help with?</Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}>{Object.keys(topics).map(category => <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: ticketCategory === category }} disabled={ticketSaving || replySaving} onPress={() => {
            if (!ticketSubject.trim() || ticketSubject === topics[ticketCategory]) setTicketSubject(topics[category]);
            setTicketCategory(category); setFormError('');
          }} style={[s.secondary, ticketCategory === category && { backgroundColor: '#CDE8DC' }]}><Text style={s.small}>{category.charAt(0) + category.slice(1).toLowerCase()}</Text></Pressable>)}</View>
          <Field validation={{ required: true, minLength: 4 }} label="Support request subject" value={ticketSubject} onChange={value => { setTicketSubject(value); setFormError(''); }} editable={!ticketSaving && !replySaving} maxLength={180} hint="4–180 characters. Choose a topic to fill a suggested subject." />
          <Field validation={{ required: true, minLength: 10 }} label="Describe support request" value={ticketMessage} onChange={value => { setTicketMessage(value); setFormError(''); }} editable={!ticketSaving && !replySaving} multiline maxLength={10000} hint={`${ticketMessage.trim().length}/10000 characters · at least 10 characters`} />
          {!!formError && <Text accessibilityRole="alert" style={s.error}>{formError}</Text>}
          <Button disabled={ticketSaving || replySaving} onPress={() => void submitTicket()} label={ticketSaving ? 'Submitting…' : 'Submit support request'} />
        </>}
        <Button label={ticketError ? 'Retry support history' : 'Refresh support history'} secondary disabled={ticketLoading || ticketSaving || replySaving} onPress={() => setReload(value => value + 1)} />
        {!!ticketError && <Text accessibilityRole="alert" style={s.error}>{ticketError}</Text>}
        {ticketLoading ? <Text style={s.small}>Loading your support requests…</Text> : !ticketError && tickets.length === 0 ? <Text style={s.small}>No support requests yet.</Text> : tickets.map(ticket => <View key={ticket.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E2EDE7', gap: 8 }}>
          <Text style={s.cardTitle}>{ticket.subject}</Text><Badge label={ticket.status} />
          {ticket.messages.map(message => <View key={message.id}><Text style={s.small}>{message.authorId === session?.user.id ? 'You' : 'Support team'} · {new Date(message.createdAt).toLocaleString('en-IN')}</Text><Text selectable style={s.body}>{message.message}</Text></View>)}
          {ticket.status !== 'CLOSED' && (replyId === ticket.id ? <>
            <Field validation={{ required: true }} label="Reply to support" value={replyMessage} onChange={value => { setReplyMessage(value); setReplyError(''); }} multiline maxLength={10000} editable={!replySaving} error={replyError} />
            <Button label={replySaving ? 'Sending…' : 'Send reply'} disabled={replySaving || ticketSaving} onPress={() => void sendReply()} />
            <Button label="Cancel reply" secondary disabled={replySaving} onPress={() => setReplyId(null)} />
          </> : <Button label={`Reply to ${ticket.subject}`} secondary disabled={replySaving || ticketSaving} onPress={() => { setReplyId(ticket.id); setReplyMessage(''); setReplyError(''); }} />)}
        </View>)}
      </View>
    </View>
  );
}
