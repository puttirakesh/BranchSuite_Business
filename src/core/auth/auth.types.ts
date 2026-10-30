export type Role = 'Platform Admin' | 'Platform Support';
export interface Account { id: string; name: string; email: string; role: Role; active: boolean; kind: string; }
export interface Session { accountId: string; }
