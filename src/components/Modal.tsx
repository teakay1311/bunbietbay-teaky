import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

type ModalSize = 'default' | 'wide';

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
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener('closeTopModal', onClose as EventListener);
    return () => {
      window.removeEventListener('closeTopModal', onClose as EventListener);
    };
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
            className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[2rem] bg-surface shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] ring-1 ring-white/10 dark:ring-white/5 ${size === 'wide' ? 'max-w-[min(96vw,72rem)]' : 'max-w-2xl'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="density-modal-shell flex shrink-0 items-center justify-between border-b border-outline-variant/30">
              <h2 className="font-headline text-xl font-bold">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 transition-all hover:bg-surface-container active:scale-95">
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
