import { demoDatabase } from './customers.mock';
export const dashboardMock = { customers: demoDatabase.tenants.length, invoices: demoDatabase.subscriptionInvoices.length, tickets: demoDatabase.saasTickets.length };
