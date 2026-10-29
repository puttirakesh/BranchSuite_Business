/** Date-only values identify the IST business day; timestamps are stored in UTC. */
export function attendanceCorrectionTimes(day: string, start: string, end: string, now = Date.now()) {
  const calendarDate = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0,10) !== day) throw new Error('Choose a valid attendance date.');
  const minutes = (value: string) => {
    const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim());
    if (!match) throw new Error('Enter both times in 12-hour format, such as 9:00 AM.');
    return (Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
  };
  const first = minutes(start);
  const last = minutes(end);
  if (first === last) throw new Error('Check-in and check-out must be different times.');
  const checkIn = new Date(new Date(`${day}T00:00:00+05:30`).getTime() + first * 60000);
  const checkOut = new Date(checkIn.getTime() + ((last - first + 1440) % 1440) * 60000);
  if (!Number.isFinite(checkIn.getTime())) throw new Error('Choose a valid recorded shift.');
  if (checkOut.getTime() > now) throw new Error('Corrected check-out cannot be in the future.');
  return { requestedCheckInAt: checkIn.toISOString(), requestedCheckOutAt: checkOut.toISOString() };
}

export function correctionTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value)).toUpperCase();
}

export function correctionDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value)).replace(/\b(am|pm)\b/gi, part => part.toUpperCase());
}
