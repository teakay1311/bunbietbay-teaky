export type SortDirection = 'asc' | 'desc';

export type SortOption<TSortKey extends string> = {
  value: TSortKey;
  label: string;
};

function directionMultiplier(direction: SortDirection) {
  return direction === 'asc' ? 1 : -1;
}

export function compareText(firstValue: string | null | undefined, secondValue: string | null | undefined, direction: SortDirection = 'asc') {
  return directionMultiplier(direction) * (firstValue ?? '').localeCompare(secondValue ?? '', 'vi', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function compareNumber(firstValue: number | null | undefined, secondValue: number | null | undefined, direction: SortDirection = 'asc') {
  const firstNumber = Number.isFinite(firstValue) ? Number(firstValue) : 0;
  const secondNumber = Number.isFinite(secondValue) ? Number(secondValue) : 0;
  return directionMultiplier(direction) * (firstNumber - secondNumber);
}

export function compareDate(firstValue: string | null | undefined, secondValue: string | null | undefined, direction: SortDirection = 'asc') {
  const firstTime = firstValue ? Date.parse(firstValue) : Number.NEGATIVE_INFINITY;
  const secondTime = secondValue ? Date.parse(secondValue) : Number.NEGATIVE_INFINITY;
  const normalizedFirst = Number.isFinite(firstTime) ? firstTime : Number.NEGATIVE_INFINITY;
  const normalizedSecond = Number.isFinite(secondTime) ? secondTime : Number.NEGATIVE_INFINITY;
  return directionMultiplier(direction) * (normalizedFirst - normalizedSecond);
}

export function stableSort<T>(items: T[], compare: (firstItem: T, secondItem: T) => number) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((firstItem, secondItem) => {
      const result = compare(firstItem.item, secondItem.item);
      return result === 0 ? firstItem.index - secondItem.index : result;
    })
    .map(({ item }) => item);
}

export function chainComparators<T>(...comparators: Array<(firstItem: T, secondItem: T) => number>) {
  return (firstItem: T, secondItem: T) => {
    for (const compare of comparators) {
      const result = compare(firstItem, secondItem);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  };
}
