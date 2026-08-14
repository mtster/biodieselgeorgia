import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for debouncing values (e.g. search input terms)
 * Prevents flooding backend/database queries on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for search inputs supporting both automatic debounce
 * and immediate execution when pressing Enter on the keyboard.
 */
export function useDebouncedSearch(initialValue: string = '', delay: number = 350) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValue);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(val);
    }, delay);
  }, [delay]);

  const triggerImmediateSearch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setDebouncedSearchTerm(searchTerm);
  }, [searchTerm]);

  const clearSearch = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setSearchTerm('');
    setDebouncedSearchTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm: handleSearchChange,
    debouncedSearchTerm,
    triggerImmediateSearch,
    clearSearch
  };
}
