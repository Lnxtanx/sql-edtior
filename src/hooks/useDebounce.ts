import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of `value` that only updates
 * after `delayMs` milliseconds of inactivity.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
