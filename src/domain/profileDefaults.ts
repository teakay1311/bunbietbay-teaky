export function getDefaultDisplayName(email: string | null) {
  if (!email) return 'Traveler';
  const [localPart] = email.split('@');
  return localPart ? localPart.slice(0, 1).toUpperCase() + localPart.slice(1) : 'Traveler';
}

export function buildDefaultAvatar(seed: string | null) {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(seed || 'traveler')}`;
}
