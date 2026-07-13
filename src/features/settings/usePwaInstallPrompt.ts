import { useCallback, useEffect, useState } from 'react';

export function usePwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(() => window.deferredPrompt ?? null);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      window.deferredPrompt = installEvent;
      setPromptEvent(installEvent);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      window.deferredPrompt = null;
      setPromptEvent(null);
      return true;
    }
    return false;
  }, [promptEvent]);

  return { canInstall: Boolean(promptEvent), install };
}
