import { api } from '../api/client';
import { call } from './http';

export type EmployeeDocumentDto = {
  id: string; companyId: string; branchId: string; employeeId: string;
  title: string; kind: 'LETTER' | 'VERIFICATION' | 'OTHER'; content: string | null;
  fileName?: string | null; mimeType?: string | null; fileSize?: number | null;
  status: string; createdAt: string; updatedAt: string;
  reportingToId?: string | null; sharedBy?: string | null;
};
export type DocumentFileDto = { fileName: string; mimeType: string; fileDataBase64: string };
// Mirrors backend support-policy.ts. Business responses only ever contain CUSTOMER-visibility messages.
export type SupportAuthorRole = 'REQUESTER' | 'COMPANY_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_ADMIN';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type SupportTicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type SupportTicketMessageDto = {
  id: string; ticketId: string; message: string; createdAt: string; visibility: 'CUSTOMER';
  authorId: string | null; authorName: string; authorRole: SupportAuthorRole;
};
export type SupportTicketHistoryDto = {
  id: string; action: string; summary: string; createdAt: string;
  actorName: string; actorRole: SupportAuthorRole; actorType: 'BUSINESS' | 'PLATFORM';
};
export type SupportTicketDto = {
  assignedToSupport?: boolean; escalationStage?: 'NONE' | 'REQUESTED' | 'ACKNOWLEDGED' | 'RESOLVED';
  id: string; companyId: string; branchId: string | null; createdById: string;
  subject: string; category: string; status: SupportTicketStatus;
  priority: SupportTicketPriority; createdAt: string; updatedAt: string; messages: SupportTicketMessageDto[];
  requester?: { id: string; name: string } | null; company?: { id: string; name: string } | null; branch?: { id: string; name: string } | null;
  history?: SupportTicketHistoryDto[];
};

/** Who wrote a message, from the server-provided role (never inferred from ids). Platform staff are shown as one team. */
export function supportAuthorLabel(message: Pick<SupportTicketMessageDto, 'authorId' | 'authorName' | 'authorRole'>, currentUserId?: string | null): string {
  switch (message.authorRole) {
    case 'PLATFORM_SUPPORT':
    case 'PLATFORM_ADMIN': return 'BranchSuite Support';
    case 'COMPANY_ADMIN': return message.authorId && message.authorId === currentUserId ? 'You (company admin)' : `${message.authorName} (company admin)`;
    default: return message.authorId && message.authorId === currentUserId ? 'You' : message.authorName;
  }
}

// Mirrors the backend lifecycle matrix so the UI never offers a transition the API will reject.
const NEXT_STATUSES: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'], IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'], RESOLVED: ['OPEN', 'IN_PROGRESS', 'CLOSED'], CLOSED: ['OPEN'],
};
export const canMoveSupportTicket = (from: SupportTicketStatus, to: SupportTicketStatus) => from === to || NEXT_STATUSES[from].includes(to);
export type BillingInvoiceDto = {
  id: string; invoiceNumber: string; description: string; amount: string; currency: string;
  status: 'ISSUED' | 'PAID' | 'VOID'; issuedAt: string; dueAt: string | null;
  paidAt: string | null; paymentNote: string | null;
};

export const employeeDocumentsApi = {
  mine: () => call(api.get<EmployeeDocumentDto[]>('/employee-documents/my')),
  list: (companyId: string, employeeId?: string) => call(api.get<EmployeeDocumentDto[]>('/employee-documents', { params: { companyId, ...(employeeId ? { employeeId } : {}) } })),
  issue: (body: { companyId: string; branchId: string; employeeId: string; title: string; kind: EmployeeDocumentDto['kind']; content?: string; fileName?: string; mimeType?: string; fileDataBase64?: string }) => call(api.post<EmployeeDocumentDto>('/employee-documents', body)),
  upload: (body: { companyId: string; branchId: string; reportingToId?: string; title: string; content?: string; fileName: string; mimeType: string; fileDataBase64: string }) => call(api.post<EmployeeDocumentDto>('/employee-documents/upload', body)),
  file: (id: string) => call(api.get<DocumentFileDto>(`/employee-documents/${id}/file`)),
};

export const supportTicketsApi = {
  mine: (ticketId?: string) => call(api.get<SupportTicketDto[]>('/support/tickets/my', { params: { ticketId } })),
  list: (companyId: string, branchId?: string) => call(api.get<SupportTicketDto[]>('/support/tickets', { params: { companyId, branchId } })),
  create: (body: { companyId: string; branchId?: string; category: string; subject: string; message: string }) => call(api.post<SupportTicketDto>('/support/tickets', body)),
  reply: (id: string, message: string, companyId?: string) => call(api.post<SupportTicketDto>(`/support/tickets/${id}/messages`, { message }, companyId ? { headers: { 'X-Company-Id': companyId } } : undefined)),
  setStatus: (id: string, status: SupportTicketDto['status'], expectedStatus?: SupportTicketDto['status']) => call(api.patch<SupportTicketDto>(`/support/tickets/${id}`, { status, ...(expectedStatus ? { expectedStatus } : {}) })),
};

export const billingApi = {
  invoices: (companyId: string) => call(api.get<BillingInvoiceDto[]>('/billing/invoices', { params: { companyId } })),
  createInvoice: (body: { companyId: string; description: string; amount: string; currency?: string; dueDate?: string; subscriptionId?: string }) => call(api.post<BillingInvoiceDto>('/billing/invoices', body)),
  recordPayment: (id: string, note: string) => call(api.post<BillingInvoiceDto>(`/billing/invoices/${id}/record-payment`, { note })),
};
