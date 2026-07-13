import type { TripPhase, TripRecord } from './models';
import { getLocalDateString } from '../utils/date';

export function getTripPhase(trip: Pick<TripRecord, 'status' | 'startDate' | 'endDate'>, today = getLocalDateString()): TripPhase {
  if (trip.status === 'draft') return 'draft';
  if (trip.status === 'completed') return 'completed';
  if (today < trip.startDate) return 'upcoming';
  if (today <= trip.endDate) return 'active';
  return 'wrap-up';
}
