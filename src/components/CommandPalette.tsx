import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './Icons';
import { useAppContext } from '../context/AppContext';

type CommandItem = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

export function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { trips, currentTripId } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const routeTripId = location.pathname.match(/^\/trips\/([^/]+)/)?.[1];
  const activeTrip = trips.find((trip) => trip.id === routeTripId) ?? trips.find((trip) => trip.id === currentTripId) ?? null;

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('openCommandPalette', open);
    return () => window.removeEventListener('openCommandPalette', open);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timerId = window.setTimeout(() => inputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const tripCommands = trips.map((trip) => ({
      id: `trip-${trip.id}`,
      label: trip.title,
      hint: `Mở trang chủ · ${trip.location}`,
      run: () => navigate(`/trips/${trip.id}`),
    }));
    const activeTripCommands = activeTrip ? [
      { id: 'schedule', label: 'Lịch trình', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/plan?tab=itinerary`) },
      { id: 'overview', label: 'Trang chủ chuyến đi', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}`) },
      { id: 'expenses', label: 'Chi tiêu', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/money`) },
      { id: 'places', label: 'Địa điểm', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/plan?tab=places`) },
      { id: 'packing', label: 'Chuẩn bị', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/prepare?tab=packing`) },
      { id: 'photos', label: 'Kỷ niệm', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/memories`) },
    ] : [];
    return [
      { id: 'new-trip', label: 'Tạo chuyến đi mới', hint: 'Mở form tạo trip', run: () => navigate('/trips', { state: { openAddTripModal: true } }) },
      { id: 'notebook', label: 'Thư viện địa điểm', hint: 'Mở bộ sưu tập địa điểm', run: () => navigate('/library') },
      { id: 'inbox', label: 'Hộp thư', hint: 'Lời mời cần phản hồi', run: () => navigate('/inbox') },
      { id: 'settings', label: 'Tài khoản', hint: 'Hồ sơ, tùy chỉnh và dữ liệu', run: () => navigate('/account/profile') },
      ...activeTripCommands,
      ...tripCommands,
    ];
  }, [activeTrip, navigate, trips]);

  const visibleCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands.slice(0, 10);
    return commands.filter((command) => `${command.label} ${command.hint}`.toLowerCase().includes(normalizedQuery)).slice(0, 12);
  }, [commands, query]);

  if (!isOpen) return null;

  const runCommand = (command: CommandItem) => {
    command.run();
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-[140] bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={() => setIsOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="command-palette-title" className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-2xl ring-1 ring-outline-variant/40" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="command-palette-title" className="sr-only">Tìm nhanh và chuyển màn hình</h2>
        <div className="flex items-center gap-3 border-b border-outline-variant/30 px-5 py-4">
          <Icons.Command className="h-5 w-5 text-secondary dark:text-gray-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm chuyến đi, màn hình hoặc hành động..."
            className="w-full bg-transparent text-base font-semibold text-on-surface outline-none placeholder:text-secondary"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {visibleCommands.map((command) => (
            <button key={command.id} type="button" onClick={() => runCommand(command)} className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-surface-container-low">
              <span className="min-w-0">
                <span className="block truncate font-headline text-sm font-bold text-on-surface">{command.label}</span>
                <span className="mt-0.5 block truncate text-xs text-secondary dark:text-gray-300">{command.hint}</span>
              </span>
              <Icons.ArrowRight className="h-4 w-4 shrink-0 text-secondary dark:text-gray-300" />
            </button>
          ))}
          {visibleCommands.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-secondary dark:text-gray-300">Không tìm thấy lệnh phù hợp.</div>
          )}
        </div>
      </div>
    </div>
  );
}
