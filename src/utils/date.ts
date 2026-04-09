export function parseLocalDate(dateString: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return new Date(dateString);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatLocalDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'vi-VN',
) {
  return parseLocalDate(dateString).toLocaleDateString(locale, options);
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateStringWithOffset(days: number, date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return getLocalDateString(nextDate);
}

export function normalizeTimeForInput(time: string) {
  const trimmedTime = time.trim();
  if (!trimmedTime) return '';

  if (/^\d{2}:\d{2}$/.test(trimmedTime)) {
    return trimmedTime;
  }

  const match = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(trimmedTime);
  if (!match) return trimmedTime;

  let [, hours, minutes, period] = match;
  let normalizedHours = Number(hours);

  if (period.toUpperCase() === 'PM' && normalizedHours < 12) {
    normalizedHours += 12;
  }

  if (period.toUpperCase() === 'AM' && normalizedHours === 12) {
    normalizedHours = 0;
  }

  return `${String(normalizedHours).padStart(2, '0')}:${minutes}`;
}
