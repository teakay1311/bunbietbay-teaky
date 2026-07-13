import type { ComponentType } from 'react';

type SmartEmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SmartEmptyState({ icon: Icon, title, message, actionLabel, onAction }: SmartEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-dashed border-outline-variant/80 bg-surface-container-lowest px-5 py-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-white">
        <Icon className="size-6" />
      </div>
      <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
      <p className="mt-2 text-pretty text-sm leading-6 text-secondary dark:text-gray-300">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
