import type { Activity } from '../../domain/models';
import { normalizeTimeForInput } from '../../utils/date';
import { chainComparators, compareDate, compareNumber, compareText, stableSort } from '../../utils/listSort';

export type ActivitySortKey = 'timeAsc' | 'timeDesc' | 'createdDesc' | 'createdAsc' | 'incompleteFirst' | 'typeAsc' | 'titleAsc';

export function filterAndSortActivities(activities: Activity[], query: string, sortBy: ActivitySortKey) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = activities.filter((activity) => !normalizedQuery
    || activity.title.toLowerCase().includes(normalizedQuery)
    || activity.location?.toLowerCase().includes(normalizedQuery)
    || activity.note?.toLowerCase().includes(normalizedQuery));
  const fallback = (left: Activity, right: Activity) => compareText(normalizeTimeForInput(left.time), normalizeTimeForInput(right.time), 'asc');
  return stableSort(filtered, chainComparators(activityComparator(sortBy), fallback));
}

export function filterAndSortCompactActivities(activities: Activity[], query: string, sortBy: ActivitySortKey) {
  const filtered = filterAndSortActivities(activities, query, sortBy);
  return stableSort(filtered, chainComparators(
    (left, right) => compareDate(left.date, right.date, 'asc'),
    activityComparator(sortBy),
    (left, right) => compareText(normalizeTimeForInput(left.time), normalizeTimeForInput(right.time), 'asc'),
  ));
}

export function groupActivitiesByDate(activities: Activity[]) {
  return activities.reduce<Record<string, Activity[]>>((groups, activity) => {
    groups[activity.date] = [...(groups[activity.date] ?? []), activity];
    return groups;
  }, {});
}

export function getScheduleInsights(activities: Activity[]) {
  const conflicts = getScheduleConflicts(activities);
  const insights: Array<{ type: 'warning' | 'info'; title: string; message: string }> = [];
  for (const conflict of conflicts.slice(0, 3)) {
    if (conflict.kind === 'missing-time') insights.push({ type: 'warning', title: 'Thiếu thời gian', message: `${conflict.current.title} chưa có giờ hợp lệ nên không thể kiểm tra xung đột.` });
    else if (conflict.kind === 'overlap') insights.push({ type: 'warning', title: 'Lịch bị chồng giờ', message: `${conflict.current.title} chồng ${conflict.minutes} phút với ${conflict.next!.title}.` });
    else insights.push({ type: 'warning', title: 'Không đủ thời gian di chuyển', message: `Chỉ có ${conflict.gapMinutes} phút giữa ${conflict.current.title} và ${conflict.next!.title}, cần ${conflict.requiredMinutes} phút.` });
  }
  return insights;
}

export type ScheduleConflict = {
  kind: 'overlap' | 'travel-gap' | 'missing-time';
  current: Activity;
  next?: Activity;
  minutes?: number;
  gapMinutes?: number;
  requiredMinutes?: number;
};

function activityStart(activity: Activity) {
  const time = normalizeTimeForInput(activity.time);
  if (!/^\d{2}:\d{2}$/.test(time) || !/^\d{4}-\d{2}-\d{2}$/.test(activity.date)) return null;
  const timestamp = new Date(`${activity.date}T${time}:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getScheduleConflicts(activities: Activity[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const timed = activities.flatMap((activity) => {
    const start = activityStart(activity);
    if (start === null) {
      conflicts.push({ kind: 'missing-time', current: activity });
      return [];
    }
    return [{ activity, start }];
  }).sort((left, right) => left.start - right.start);
  for (let index = 0; index < timed.length - 1; index += 1) {
    const current = timed[index];
    const next = timed[index + 1];
    const end = current.start + (current.activity.durationMinutes ?? 60) * 60_000;
    const gapMinutes = Math.floor((next.start - end) / 60_000);
    if (gapMinutes < 0) conflicts.push({ kind: 'overlap', current: current.activity, next: next.activity, minutes: Math.abs(gapMinutes) });
    else if (gapMinutes < (current.activity.travelMinutesAfter ?? 0)) conflicts.push({ kind: 'travel-gap', current: current.activity, next: next.activity, gapMinutes, requiredMinutes: current.activity.travelMinutesAfter ?? 0 });
  }
  return conflicts;
}

function activityComparator(sortBy: ActivitySortKey) {
  return (left: Activity, right: Activity) => {
    switch (sortBy) {
      case 'timeDesc': return compareText(normalizeTimeForInput(left.time), normalizeTimeForInput(right.time), 'desc');
      case 'createdDesc': return compareDate(left.createdAt ?? `${left.date}T${normalizeTimeForInput(left.time)}`, right.createdAt ?? `${right.date}T${normalizeTimeForInput(right.time)}`, 'desc');
      case 'createdAsc': return compareDate(left.createdAt ?? `${left.date}T${normalizeTimeForInput(left.time)}`, right.createdAt ?? `${right.date}T${normalizeTimeForInput(right.time)}`, 'asc');
      case 'incompleteFirst': return compareNumber(left.isCompleted ? 1 : 0, right.isCompleted ? 1 : 0, 'asc');
      case 'typeAsc': return compareText(left.type, right.type, 'asc');
      case 'titleAsc': return compareText(left.title, right.title, 'asc');
      default: return compareText(normalizeTimeForInput(left.time), normalizeTimeForInput(right.time), 'asc');
    }
  };
}
