export type CategoryOption = {
  value: string;
  label: string;
};

export const NEW_CATEGORY_VALUE = '__new_category__';

export const EXPENSE_CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'Ăn uống', label: 'Ăn uống' },
  { value: 'Di chuyển', label: 'Di chuyển' },
  { value: 'Lưu trú', label: 'Lưu trú' },
  { value: 'Giải trí', label: 'Giải trí' },
  { value: 'Khác', label: 'Khác' },
];

export const PLACE_TYPE_OPTIONS: CategoryOption[] = [
  { value: 'hotel', label: 'Khách sạn / Lưu trú' },
  { value: 'restaurant', label: 'Nhà hàng / Quán ăn' },
  { value: 'other', label: 'Khác' },
];

export const ACTIVITY_TYPE_OPTIONS: CategoryOption[] = [
  { value: 'activity', label: 'Hoạt động chung' },
  { value: 'flight', label: 'Chuyến bay / Di chuyển' },
  { value: 'hotel', label: 'Khách sạn / Lưu trú' },
  { value: 'restaurant', label: 'Ăn uống' },
];

export const PACKING_CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'clothes', label: 'Quần áo' },
  { value: 'toiletries', label: 'Đồ cá nhân' },
  { value: 'electronics', label: 'Đồ điện tử' },
  { value: 'documents', label: 'Giấy tờ' },
  { value: 'other', label: 'Khác' },
];

export function normalizeCategoryValue(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function mergeCategoryOptions(defaultOptions: CategoryOption[], currentValues: Array<string | undefined | null>) {
  const merged = new Map(defaultOptions.map((option) => [option.value, option]));
  currentValues.forEach((value) => {
    const normalizedValue = normalizeCategoryValue(value ?? '');
    if (normalizedValue && !merged.has(normalizedValue)) {
      merged.set(normalizedValue, { value: normalizedValue, label: normalizedValue });
    }
  });
  return Array.from(merged.values());
}

export function getCategoryLabel(options: CategoryOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}
