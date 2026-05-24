import { useEffect, useMemo, useState } from 'react';

import { type CategoryOption, NEW_CATEGORY_VALUE, normalizeCategoryValue } from '../utils/tripCategories';

type CategorySelectWithCreateProps = {
  name: string;
  label?: string;
  options: CategoryOption[];
  defaultValue?: string;
  fallbackValue?: string;
  className?: string;
  createLabel?: string;
  resetKey?: string;
};

export function CategorySelectWithCreate({
  name,
  label = 'Phân loại',
  options,
  defaultValue,
  fallbackValue,
  className = '',
  createLabel = 'Thêm phân loại mới',
  resetKey,
}: CategorySelectWithCreateProps) {
  const initialValue = defaultValue || fallbackValue || options[0]?.value || '';
  const [value, setValue] = useState(initialValue);
  const [isCreating, setIsCreating] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [localOptions, setLocalOptions] = useState<CategoryOption[]>(options);

  useEffect(() => {
    setLocalOptions(options);
    setValue(defaultValue || fallbackValue || options[0]?.value || '');
    setIsCreating(false);
    setDraftValue('');
  }, [defaultValue, fallbackValue, options, resetKey]);

  const selectOptions = useMemo(() => {
    if (!value || localOptions.some((option) => option.value === value)) {
      return localOptions;
    }
    return [...localOptions, { value, label: value }];
  }, [localOptions, value]);

  const commitDraft = () => {
    const normalizedValue = normalizeCategoryValue(draftValue);
    if (!normalizedValue) return;
    setLocalOptions((currentOptions) => currentOptions.some((option) => option.value === normalizedValue)
      ? currentOptions
      : [...currentOptions, { value: normalizedValue, label: normalizedValue }]);
    setValue(normalizedValue);
    setIsCreating(false);
    setDraftValue('');
  };

  return (
    <div>
      <label className="block font-label text-xs font-bold text-secondary dark:text-gray-300 mb-1">{label}</label>
      {isCreating ? (
        <div className="flex gap-2">
          <input
            required
            name={name}
            type="text"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitDraft}
            autoFocus
            placeholder="Nhập phân loại mới..."
            className={`min-w-0 flex-1 ${className}`}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={commitDraft}
            className="shrink-0 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary transition hover:opacity-90"
          >
            Thêm
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setIsCreating(false);
              setDraftValue('');
            }}
            className="shrink-0 rounded-xl bg-surface-container-high px-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-highest"
          >
            Hủy
          </button>
        </div>
      ) : (
        <select
          required
          name={name}
          value={value}
          onChange={(event) => {
            if (event.target.value === NEW_CATEGORY_VALUE) {
              setIsCreating(true);
              setDraftValue('');
              return;
            }
            setValue(event.target.value);
          }}
          className={className}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ {createLabel}</option>
        </select>
      )}
    </div>
  );
}
