import type { CSSProperties } from 'react';
import { Icons } from './Icons';

const variants = ['round', 'hex', 'rect'] as const;
const colors = ['#E86655', '#6E9B79', '#B55C4C'] as const;
const rotations = [-3, 2, -1] as const;

function hashTripId(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

export function getTripStampDesign(tripId: string) {
  const hash = hashTripId(tripId);
  return {
    variant: variants[hash % variants.length],
    color: colors[hash % colors.length],
    rotation: rotations[hash % rotations.length],
  };
}

export function getTripStampLabel(location?: string) {
  return location?.split(',')[0]?.trim() || 'Hành trình';
}

export function TripStamp({ tripId, location, className = '', compact = false }: { tripId: string; location?: string; className?: string; compact?: boolean }) {
  const design = getTripStampDesign(tripId);
  const style = {
    '--stamp-color': design.color,
    transform: `rotate(${design.rotation}deg)`,
  } as CSSProperties;

  return (
    <span aria-hidden="true" className={`trip-stamp trip-stamp--${design.variant} ${compact ? 'trip-stamp--compact' : ''} ${className}`} style={style}>
      <Icons.Plane className="trip-stamp__icon" />
      <span className="trip-stamp__label">{getTripStampLabel(location)}</span>
      <span className="trip-stamp__caption">Bunbietbay</span>
    </span>
  );
}
