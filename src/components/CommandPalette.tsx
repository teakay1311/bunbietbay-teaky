import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { trips, currentTripId } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTrip = trips.find((trip) => trip.id === currentTripId) ?? trips[0] ?? null;

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
    const timerId = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timerId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const tripCommands = trips.map((trip) => ({
      id: `trip-${trip.id}`,
      label: trip.title,
      hint: `Mở lịch trình · ${trip.location}`,
      run: () => navigate(`/trips/${trip.id}/schedule`),
    }));
    const activeTripCommands = activeTrip ? [
      { id: 'schedule', label: 'Lịch trình', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/schedule`) },
      { id: 'overview', label: 'Tổng quan', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/overview`) },
      { id: 'expenses', label: 'Chi tiêu', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/expenses`) },
      { id: 'places', label: 'Địa điểm', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/places`) },
      { id: 'packing', label: 'Hành lý', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/packing`) },
      { id: 'photos', label: 'Thư viện ảnh', hint: activeTrip.title, run: () => navigate(`/trips/${activeTrip.id}/photos`) },
    ] : [];
    return [
      { id: 'new-trip', label: 'Tạo chuyến đi mới', hint: 'Mở form tạo trip', run: () => navigate('/trips', { state: { openAddTripModal: true } }) },
      { id: 'notebook', label: 'Cẩm nang địa điểm', hint: 'Mở sổ tay địa điểm', run: () => navigate('/notebook') },
      { id: 'settings', label: 'Cài đặt', hint: 'Giao diện, dữ liệu, phím tắt', run: () => navigate('/settings') },
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
      <div className="mx-auto mt-20 max-w-2xl overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-2xl ring-1 ring-outline-variant/40" onMouseDown={(event) => event.stopPropagation()}>
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
