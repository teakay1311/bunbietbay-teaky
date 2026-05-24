import { useState, ChangeEvent, useEffect } from 'react';

interface FormattedNumberInputProps {
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

/**
 * Safe math evaluator that supports +, -, *, / and parentheses.
 * Does NOT use `new Function()` or `eval()`, so it is CSP-compliant.
 */
function safeEvaluate(expr: string): number | null {
  const tokens: (number | string)[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        num += expr[i++];
      }
      tokens.push(Number(num));
    } else if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      i++;
    } else {
      i++;
    }
  }

  let pos = 0;

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++] as string;
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++] as string;
      const right = parseFactor();
      result = op === '*' ? result * right : result / right;
    }
    return result;
  }

  function parseFactor(): number {
    if (tokens[pos] === '(') {
      pos++; // skip '('
      const result = parseExpr();
      pos++; // skip ')'
      return result;
    }
    return tokens[pos++] as number;
  }

  try {
    const result = parseExpr();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export function FormattedNumberInput({ name, defaultValue = '', placeholder, className, required }: FormattedNumberInputProps) {
  const formatNumber = (val: string) => {
    const numericValue = val.replace(/[^\d+\-*/().]/g, '');
    if (/[+\-*/]/.test(numericValue)) return numericValue;
    return numericValue.replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const [displayValue, setDisplayValue] = useState(formatNumber(String(defaultValue)));

  useEffect(() => {
    setDisplayValue(formatNumber(String(defaultValue)));
  }, [defaultValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(formatNumber(e.target.value));
  };

  const handleBlur = () => {
    try {
      const expression = displayValue.replace(/\./g, '').replace(/\s/g, '');
      if (/^[0-9+\-*/()]+$/.test(expression) && /[+\-*/]/.test(expression)) {
        const result = safeEvaluate(expression);
        if (result !== null) {
          setDisplayValue(formatNumber(String(Math.round(result))));
          return;
        }
      }
      setDisplayValue(formatNumber(displayValue));
    } catch {
      setDisplayValue(formatNumber(displayValue));
    }
  };

  // The actual numeric value to be submitted.
  // If the display contains a math expression, evaluate it first.
  const numericValue = (() => {
    const stripped = displayValue.replace(/\./g, '').replace(/\s/g, '');
    if (/^[0-9+\-*/()]+$/.test(stripped) && /[+\-*/]/.test(stripped)) {
      const result = safeEvaluate(stripped);
      if (result !== null) return String(Math.round(result));
    }
    return displayValue.replace(/[^\d]/g, '');
  })();

  return (
    <>
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        required={required}
      />
      <input type="hidden" name={name} value={numericValue} />
    </>
  );
}
