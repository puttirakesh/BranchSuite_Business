export type SlaState = 'NOT_TRACKED' | 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'MET';
const defaults: Record<string, [number, number]> = { URGENT: [30, 240], HIGH: [120, 1440], NORMAL: [480, 4320], LOW: [1440, 10080] };

export function initialSla(priority = 'NORMAL', now = new Date(), settings = process.env) {
  const baseline = defaults[priority];
  if (!baseline) throw new Error('Unknown Support priority');
  const value = (kind: string, fallback: number) => {
    const raw = settings[`SUPPORT_SLA_${priority}_${kind}_MINUTES`];
    const minutes = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 525600) throw new Error('Invalid Support SLA configuration');
    return minutes;
  };
  const responseTargetMinutes = value('RESPONSE', baseline[0]);
  const resolutionTargetMinutes = value('RESOLUTION', baseline[1]);
  const slaPolicyVersion = settings.SUPPORT_SLA_POLICY_VERSION || 'development-v1';
  if (resolutionTargetMinutes < responseTargetMinutes || slaPolicyVersion.length > 80) throw new Error('Invalid Support SLA configuration');
  return { slaPolicyVersion, responseTargetMinutes, resolutionTargetMinutes,
    responseDueAt: new Date(now.getTime() + responseTargetMinutes * 60000), resolutionDueAt: new Date(now.getTime() + resolutionTargetMinutes * 60000) };
}

export function slaState(ticket: { responseDueAt?: Date | null; resolutionDueAt?: Date | null; firstResponseAt?: Date | null; resolvedAt?: Date | null }, now = new Date()): SlaState {
  if (!ticket.responseDueAt || !ticket.resolutionDueAt) return 'NOT_TRACKED';
  if ((ticket.firstResponseAt ?? now) > ticket.responseDueAt || (ticket.resolvedAt ?? now) > ticket.resolutionDueAt) return 'OVERDUE';
  if (ticket.firstResponseAt && ticket.resolvedAt) return 'MET';
  const soon = new Date(now.getTime() + 3600000);
  if ((!ticket.firstResponseAt && ticket.responseDueAt <= soon) || (!ticket.resolvedAt && ticket.resolutionDueAt <= soon)) return 'DUE_SOON';
  return 'ON_TRACK';
}
