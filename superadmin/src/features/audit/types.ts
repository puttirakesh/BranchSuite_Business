export interface AuditEvent {
  id: string;
  action: string;
  detail: string;
  actor: string;
  time: string;
  module: string | null;
}
