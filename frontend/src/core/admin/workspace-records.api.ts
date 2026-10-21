import { api } from '../api/client';
import { call } from './http';

export type EmployeeDocumentDto = {
  id: string; companyId: string; branchId: string; employeeId: string;
  title: string; kind: 'LETTER' | 'VERIFICATION' | 'OTHER'; content: string | null;
  fileName?: string | null; mimeType?: string | null; fileSize?: number | null;
  status: string; createdAt: string; updatedAt: string;
};
export type DocumentFileDto = { fileName: string; mimeType: string; fileDataBase64: string };
export type SupportTicketMessageDto = { id: string; ticketId: string; authorId: string; message: string; createdAt: string };
export type SupportTicketDto = {
  id: string; companyId: string; branchId: string | null; createdById: string;
  subject: string; category: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: string; createdAt: string; updatedAt: string; messages: SupportTicketMessageDto[];
};
export type BillingInvoiceDto = {
  id: string; invoiceNumber: string; description: string; amount: string; currency: string;
  status: 'ISSUED' | 'PAID' | 'VOID'; issuedAt: string; dueAt: string | null;
  paidAt: string | null; paymentNote: string | null;
};

export const employeeDocumentsApi = {
  mine: () => call(api.get<EmployeeDocumentDto[]>('/employee-documents/my')),
  list: (companyId: string, employeeId?: string) => call(api.get<EmployeeDocumentDto[]>('/employee-documents', { params: { companyId, ...(employeeId ? { employeeId } : {}) } })),
  issue: (body: { companyId: string; branchId: string; employeeId: string; title: string; kind: EmployeeDocumentDto['kind']; content?: string; fileName?: string; mimeType?: string; fileDataBase64?: string }) => call(api.post<EmployeeDocumentDto>('/employee-documents', body)),
  file: (id: string) => call(api.get<DocumentFileDto>(`/employee-documents/${id}/file`)),
};

export const supportTicketsApi = {
  mine: () => call(api.get<SupportTicketDto[]>('/support/tickets/my')),
  list: (companyId: string) => call(api.get<SupportTicketDto[]>('/support/tickets', { params: { companyId } })),
  create: (body: { companyId: string; branchId?: string; category: string; subject: string; message: string }) => call(api.post<SupportTicketDto>('/support/tickets', body)),
  reply: (id: string, message: string) => call(api.post<SupportTicketDto>(`/support/tickets/${id}/messages`, { message })),
  setStatus: (id: string, status: SupportTicketDto['status']) => call(api.patch<SupportTicketDto>(`/support/tickets/${id}`, { status })),
};

export const billingApi = {
  invoices: (companyId: string) => call(api.get<BillingInvoiceDto[]>('/billing/invoices', { params: { companyId } })),
  createInvoice: (body: { companyId: string; description: string; amount: string; currency?: string; dueDate?: string; subscriptionId?: string }) => call(api.post<BillingInvoiceDto>('/billing/invoices', body)),
  recordPayment: (id: string, note: string) => call(api.post<BillingInvoiceDto>(`/billing/invoices/${id}/record-payment`, { note })),
};
