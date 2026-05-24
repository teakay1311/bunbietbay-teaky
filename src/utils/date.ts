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

export function getLocalDateRange(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(getLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
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

export function formatLocalDateTime(dateString: string, locale = 'vi-VN') {
  return new Date(dateString).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
