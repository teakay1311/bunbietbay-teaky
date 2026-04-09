import { useState, ChangeEvent, useEffect } from 'react';

interface FormattedNumberInputProps {
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function FormattedNumberInput({ name, defaultValue = '', placeholder, className, required }: FormattedNumberInputProps) {
  const formatNumber = (val: string) => {
    const numericValue = val.replace(/\D/g, '');
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const [displayValue, setDisplayValue] = useState(formatNumber(String(defaultValue)));

  useEffect(() => {
    setDisplayValue(formatNumber(String(defaultValue)));
  }, [defaultValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(formatNumber(e.target.value));
  };

  // The actual numeric value to be submitted
  const numericValue = displayValue.replace(/\./g, '');

  return (
    <>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        required={required}
      />
      <input type="hidden" name={name} value={numericValue} />
    </>
  );
}
