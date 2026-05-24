import { normalizeTimeForInput } from './date';

export function formatIcsDate(date: string, time: string) {
  const normalizedInputTime = normalizeTimeForInput(time);
  const normalizedTime = /^\d{2}:\d{2}$/.test(normalizedInputTime) ? normalizedInputTime : '09:00';
  return `${date.replaceAll('-', '')}T${normalizedTime.replace(':', '')}00`;
}
