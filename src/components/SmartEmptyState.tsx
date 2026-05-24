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
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-outline-variant/80 bg-surface-container-lowest px-6 py-12 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary dark:text-white">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="font-headline text-xl font-bold text-on-surface">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary dark:text-gray-300">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
