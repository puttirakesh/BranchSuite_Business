export interface TicketMessage { by: string; text: string; internal: boolean; time: string; }
export interface Ticket { id: string; tenantId: string; subject: string; category: string; status: 'Open' | 'In progress' | 'Resolved'; priority: string; createdOn: string; messages: TicketMessage[]; }
