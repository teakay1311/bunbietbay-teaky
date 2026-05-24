const DEVICE_ID_KEY = 'bunbietbay-device-id';

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}`;
}

export function getDeviceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingDeviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId = createDeviceId();
  window.localStorage.setItem(DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
}

export function getDeviceLabel() {
  if (typeof navigator === 'undefined') {
    return 'Unknown device';
  }

  const environmentLabel = window.desktopApi?.isDesktopApp ? 'Desktop' : 'Web';
  const platformLabel = navigator.platform || 'Unknown platform';
  return `${environmentLabel} - ${platformLabel}`;
}
