import { Icons } from './Icons';
import type { SortOption } from '../utils/listSort';

type SortSelectProps<TSortKey extends string> = {
  value: TSortKey;
  options: Array<SortOption<TSortKey>>;
  onChange: (value: TSortKey) => void;
  className?: string;
};

export function SortSelect<TSortKey extends string>({ value, options, onChange, className = '' }: SortSelectProps<TSortKey>) {
  return (
    <label className={`flex min-w-0 items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2 text-on-surface transition-colors hover:bg-surface-container-highest sm:px-4 ${className}`}>
      <Icons.Filter className="h-4 w-4 shrink-0 text-secondary opacity-70" />
      <span className="sr-only">Sắp xếp</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TSortKey)}
        className="min-w-0 flex-1 cursor-pointer truncate bg-transparent text-sm font-semibold text-on-surface outline-none"
        aria-label="Sắp xếp"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
