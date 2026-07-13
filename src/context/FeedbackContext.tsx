import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';

type ToastTone = 'info' | 'success' | 'error';

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

type ToastRecord = ToastInput & {
  id: string;
};

type ConfirmInput = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type ConfirmState = ConfirmInput & {
  id: string;
};

type FeedbackContextType = {
  showToast: (toast: ToastInput) => void;
  confirm: (options: ConfirmInput) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

function getToastClasses(tone: ToastTone) {
  switch (tone) {
    case 'success':
      return {
        shell: 'border-emerald-200 bg-emerald-50 text-emerald-950',
        badge: 'bg-emerald-600 text-white',
      };
    case 'error':
      return {
        shell: 'border-error/30 bg-error-container text-on-error-container',
        badge: 'bg-error text-white',
      };
    default:
      return {
        shell: 'border-outline-variant/40 bg-surface-container-lowest text-on-surface',
        badge: 'bg-slate-950 text-white',
      };
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((toastId: string) => {
    toastTimersRef.current.delete(toastId);
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((toast: ToastInput) => {
    const nextToastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast: ToastRecord = {
      id: nextToastId,
      tone: 'info',
      durationMs: 4200,
      ...toast,
    };

    setToasts((currentToasts) => [...currentToasts, nextToast]);
  }, []);

  useEffect(() => {
    const activeTimers = toastTimersRef.current;

    toasts.forEach((toast) => {
      if (activeTimers.has(toast.id)) {
        return;
      }

      const timerId = window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.durationMs ?? 4200);
      activeTimers.set(toast.id, timerId);
    });

    // Clean up timers for toasts that have been removed
    activeTimers.forEach((_timerId, toastId) => {
      if (!toasts.some((toast) => toast.id === toastId)) {
        window.clearTimeout(activeTimers.get(toastId)!);
        activeTimers.delete(toastId);
      }
    });
  }, [dismissToast, toasts]);

  const confirm = useCallback((options: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        confirmLabel: 'Xác nhận',
        cancelLabel: 'Hủy',
        tone: 'default',
        ...options,
      });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    confirmResolverRef.current?.(result);
    confirmResolverRef.current = null;
    setConfirmState(null);
  }, []);

  const value = useMemo<FeedbackContextType>(() => ({
    showToast,
    confirm,
  }), [confirm, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 top-24 z-[120] flex justify-center px-4">
        <div className="flex w-full max-w-xl flex-col gap-3">
          {toasts.map((toast) => {
            const classes = getToastClasses(toast.tone ?? 'info');
            return (
              <div key={toast.id} className={`pointer-events-auto overflow-hidden rounded-[1.5rem] border shadow-[0_18px_40px_rgba(0,0,0,0.08)] backdrop-blur ${classes.shell}`}>
                <div className="flex items-start gap-3 px-4 py-4">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${classes.badge}`}>
                    {toast.tone === 'error' ? '!' : toast.tone === 'success' ? 'OK' : 'i'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-headline text-base font-black tracking-[-0.02em]">{toast.title}</p>
                    {toast.message && (
                      <p className="mt-1 text-sm leading-6 opacity-80">{toast.message}</p>
                    )}
                    {toast.action && (
                      <button
                        onClick={() => { toast.action!.onClick(); dismissToast(toast.id); }}
                        className="mt-3 text-sm font-bold border border-current hover:bg-black/10 px-4 py-1.5 rounded-full transition-colors active:scale-95"
                      >
                        {toast.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-full p-2 transition hover:bg-black/5"
                    aria-label="Đóng thông báo"
                  >
                    <Icons.Plus className="h-4 w-4 rotate-45" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={Boolean(confirmState)} onClose={() => closeConfirm(false)} title={confirmState?.title ?? 'Xác nhận'}>
        {confirmState && (
          <div>
            <p className="text-sm leading-7 text-secondary">{confirmState.message}</p>
            <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/30 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="density-button rounded-2xl border border-outline-variant/60 bg-surface-container-low font-semibold text-on-surface transition hover:border-primary"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`density-button rounded-2xl font-semibold text-white transition hover:opacity-95 ${confirmState.tone === 'danger' ? 'bg-error' : 'bg-slate-950'}`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }

  return context;
}
