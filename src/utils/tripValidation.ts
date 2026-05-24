export function getTripDateValidationError(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return null;
  }

  if (startDate > endDate) {
    return 'Ngày về phải bằng hoặc sau ngày đi.';
  }

  return null;
}
