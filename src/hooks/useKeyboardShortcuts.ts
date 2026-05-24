import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable || tag === 'select';
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTripId } = useAppContext();
  const pendingSequenceRef = useRef<{ key: string; expiresAt: number } | null>(null);
  const routeTripId = location.pathname.match(/^\/trips\/([^/]+)/)?.[1] ?? null;
  const activeTripId = currentTripId ?? routeTripId;

  useEffect(() => {
    const openTripRoute = (path: string) => {
      if (!activeTripId) {
        return;
      }

      navigate(`/trips/${activeTripId}/${path}`);
    };

    const focusSearch = () => {
      const searchInput = document.querySelector('input[type="search"], input[data-search-input="true"], input[placeholder*="Tìm"], input[placeholder*="tìm"], input[placeholder*="Search"], input[placeholder*="search"]') as HTMLInputElement | null;
      searchInput?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMetaPressed = event.ctrlKey || event.metaKey;
      const isTyping = isTypingTarget(event.target);

      if (key === 'escape') {
        window.dispatchEvent(new CustomEvent('closeTopModal'));
        return;
      }

      if (isMetaPressed && key === 'n') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('openAddTripModal'));
        navigate('/trips', { state: { openAddTripModal: true } });
        return;
      }

      if (isMetaPressed && key === ',') {
        event.preventDefault();
        navigate('/settings');
        return;
      }

      if (isMetaPressed && key === 'k') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('openCommandPalette'));
        return;
      }

      if (isMetaPressed && event.shiftKey && key === 'm' && activeTripId) {
        event.preventDefault();
        navigate(`/trips/${activeTripId}/members`, { state: { openInviteMemberModal: true } });
        return;
      }

      if (!isTyping && key === '/') {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (!isTyping && key === '?') {
        event.preventDefault();
        navigate('/settings', { state: { section: 'shortcuts' } });
        return;
      }

      const pendingSequence = pendingSequenceRef.current;
      if (pendingSequence && pendingSequence.expiresAt > Date.now()) {
        pendingSequenceRef.current = null;
        switch (`${pendingSequence.key}:${key}`) {
          case 'g:s':
            event.preventDefault();
            openTripRoute('schedule');
            return;
          case 'g:o':
            event.preventDefault();
            openTripRoute('overview');
            return;
          case 'g:e':
            event.preventDefault();
            openTripRoute('expenses');
            return;
          case 'g:m':
            event.preventDefault();
            openTripRoute('members');
            return;
          case 'g:p':
            event.preventDefault();
            openTripRoute('places');
            return;
          case 'g:h':
            event.preventDefault();
            openTripRoute('packing');
            return;
          case 'g:i':
            event.preventDefault();
            openTripRoute('photos');
            return;
          default:
            break;
        }
      }

      if (!isTyping && key === 'g') {
        pendingSequenceRef.current = {
          key: 'g',
          expiresAt: Date.now() + 1600,
        };
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTripId, navigate]);
}
