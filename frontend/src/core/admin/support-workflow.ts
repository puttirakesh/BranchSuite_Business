export const SUPPORT_CATEGORIES = ['ACCOUNT', 'PAYROLL', 'ATTENDANCE', 'CRM', 'OTHER'] as const;

export function supportTicketInput(companyId: string, branchId: string, category: string, subject: string, message: string, branchIds: string[]) {
  if (!companyId) throw new Error('Choose a company before raising an issue.');
  if (!(SUPPORT_CATEGORIES as readonly string[]).includes(category)) throw new Error('Choose a support category.');
  const cleanSubject = subject.trim(), cleanMessage = message.trim();
  if (cleanSubject.length < 4 || cleanSubject.length > 180) throw new Error('Enter a subject of 4–180 characters.');
  if (cleanMessage.length < 10 || cleanMessage.length > 10000) throw new Error('Enter a description of 10–10,000 characters.');
  if (branchId && !branchIds.includes(branchId)) throw new Error('Choose a currently authorized branch or leave the branch blank.');
  return { companyId, ...(branchId ? { branchId } : {}), category, subject: cleanSubject, message: cleanMessage };
}

/** Both staff support modes use the same screen; backend decides own vs company visibility. */
export function notificationDestination(href: string, staff: boolean): string {
  if (!staff) return href;
  return href.replace(/^\/employee\/help(?=[?#]|$)/, '/admin/platform-support')
    .replace(/^\/employee\/leave(?=[/?#]|$)/, '/admin/my-leave')
    .replace(/^\/employee\/attendance\/correction(?=[?#]|$)/, '/admin/attendance')
    .replace(/^\/employee\/tasks\//, '/admin/my-tasks/');
}
