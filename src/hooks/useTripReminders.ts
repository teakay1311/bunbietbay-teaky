import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { normalizeTimeForInput, parseLocalDate } from '../utils/date';

function getReminderStorageKey(reminderId: string) {
  return `bunbietbay-reminder:${reminderId}`;
}

function shouldSendReminder(reminderId: string, scheduledAt: number, leadMinutes: number) {
  const reminderWindowStart = scheduledAt - leadMinutes * 60 * 1000;
  const now = Date.now();

  if (now < reminderWindowStart || now > scheduledAt) {
    return false;
  }

  return !window.localStorage.getItem(getReminderStorageKey(reminderId));
}

function markReminderSent(reminderId: string) {
  window.localStorage.setItem(getReminderStorageKey(reminderId), new Date().toISOString());
}

function cleanupReminderMarks(activeReminderIds: Set<string>) {
  const prefix = 'bunbietbay-reminder:';
  const staleMs = 14 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(prefix)) {
      continue;
    }

    const reminderId = key.slice(prefix.length);
    const rawMarkedAt = window.localStorage.getItem(key);
    const markedAtMs = rawMarkedAt ? Date.parse(rawMarkedAt) : NaN;
    const isMissingFromCurrentSchedule = !activeReminderIds.has(reminderId);
    const isOlderThanRetention = Number.isFinite(markedAtMs) && now - markedAtMs > staleMs;
    if (isMissingFromCurrentSchedule || isOlderThanRetention) {
      window.localStorage.removeItem(key);
    }
  }
}

export function useTripReminders() {
  const { trips, activities, isHydrated } = useAppContext();
  const { getEffectiveTripReminders, notificationPermission } = useSettings();

  useEffect(() => {
    if (!isHydrated || notificationPermission !== 'granted' || typeof Notification === 'undefined') {
      return;
    }

    const checkReminders = () => {
      const activeReminderIds = new Set<string>();
      trips.forEach((trip) => {
        const settings = getEffectiveTripReminders(trip.id);
        if (!settings.enabled) return;
        const tripStartAt = parseLocalDate(trip.startDate).getTime();
        const tripReminderId = `trip-start:${trip.id}:${trip.startDate}`;
        activeReminderIds.add(tripReminderId);
        if (shouldSendReminder(tripReminderId, tripStartAt, settings.tripStartLeadMinutes)) {
          new Notification('Chuyến đi sắp bắt đầu', {
            body: `${trip.title} sẽ bắt đầu vào ${trip.startDate}. Kiểm tra lại hành lý và lịch trình nhé.`,
          });
          markReminderSent(tripReminderId);
        }
      });

      activities.forEach((activity) => {
        const settings = getEffectiveTripReminders(activity.tripId);
        if (!settings.enabled) return;
        const normalizedTime = normalizeTimeForInput(activity.time);
        if (!normalizedTime) {
          return;
        }

        const [hour, minute] = normalizedTime.split(':').map(Number);
        const activityDate = parseLocalDate(activity.date);
        activityDate.setHours(hour, minute, 0, 0);
        const activityReminderId = `activity:${activity.id}:${activity.date}:${normalizedTime}`;
        activeReminderIds.add(activityReminderId);

        if (shouldSendReminder(activityReminderId, activityDate.getTime(), settings.activityLeadMinutes)) {
          new Notification('Hoạt động sắp diễn ra', {
            body: `${activity.title} tại ${activity.location} sẽ bắt đầu lúc ${activity.time}.`,
          });
          markReminderSent(activityReminderId);
        }
      });
      cleanupReminderMarks(activeReminderIds);
    };

    checkReminders();
    const intervalId = window.setInterval(checkReminders, 60_000);
    return () => window.clearInterval(intervalId);
  }, [activities, getEffectiveTripReminders, isHydrated, notificationPermission, trips]);
}
