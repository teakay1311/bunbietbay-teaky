import { normalizeTimeForInput } from './date';

export function sortActivitiesByTime<T extends { time: string }>(activities: T[]) {
  return [...activities].sort((firstActivity, secondActivity) => {
    return normalizeTimeForInput(firstActivity.time).localeCompare(normalizeTimeForInput(secondActivity.time));
  });
}
