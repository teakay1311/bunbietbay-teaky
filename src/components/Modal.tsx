import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { motion, AnimatePresence } from 'motion/react';

type ModalSize = 'default' | 'wide';

const openModalStack: string[] = [];
let bodyOverflowBeforeFirstModal: string | null = null;
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'default',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: ModalSize;
}) {
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openModalStack.length === 0) bodyOverflowBeforeFirstModal = document.body.style.overflow;
    openModalStack.push(modalId);
    document.body.style.overflow = 'hidden';

    const focusDialog = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialogRef.current)?.focus();
    });

    const closeIfTopmost = () => {
      if (openModalStack.at(-1) === modalId) onCloseRef.current();
    };

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || openModalStack.at(-1) !== modalId || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('closeTopModal', closeIfTopmost);
    window.addEventListener('keydown', trapFocus);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      window.removeEventListener('closeTopModal', closeIfTopmost);
      window.removeEventListener('keydown', trapFocus);
      const stackIndex = openModalStack.lastIndexOf(modalId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      if (openModalStack.length === 0) {
        document.body.style.overflow = bodyOverflowBeforeFirstModal ?? '';
        bodyOverflowBeforeFirstModal = null;
      }
      previouslyFocused?.focus();
    };
  }, [isOpen, modalId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-md sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
            className={`flex max-h-[calc(100dvh-0.75rem)] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5 sm:max-h-[90vh] sm:rounded-[2rem] ${size === 'wide' ? 'sm:max-w-[min(96vw,72rem)]' : 'sm:max-w-2xl'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="density-modal-shell flex shrink-0 items-center justify-between border-b border-outline-variant/30">
              <h2 id={titleId} className="min-w-0 pr-3 font-headline text-lg font-bold sm:text-xl">{title}</h2>
              <button aria-label="Đóng hộp thoại" title="Đóng" onClick={onClose} className="rounded-full p-2 transition-all hover:bg-surface-container active:scale-95">
                <Icons.Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>
            <div className="density-modal-shell no-scrollbar flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
