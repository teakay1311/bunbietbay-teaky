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
  if (activities.length < 2) return [];
  const toMinutes = (time: string) => {
    const [hours, minutes] = normalizeTimeForInput(time).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const ordered = stableSort(activities, (left, right) => compareNumber(toMinutes(left.time), toMinutes(right.time), 'asc'));
  const insights: Array<{ type: 'warning' | 'info'; title: string; message: string }> = [];
  for (let index = 0; index < ordered.length - 1 && insights.length < 3; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const gap = toMinutes(next.time) - toMinutes(current.time);
    if (gap < 30) {
      insights.push({ type: 'warning', title: 'Lịch có thể bị sát giờ', message: `${current.time} ${current.title} và ${next.time} ${next.title} chỉ cách nhau ${Math.max(gap, 0)} phút.` });
    } else if (gap >= 180) {
      insights.push({ type: 'info', title: 'Khoảng trống dài', message: `Có khoảng ${Math.round(gap / 60)} giờ giữa ${current.title} và ${next.title}.` });
    }
  }
  return insights;
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
