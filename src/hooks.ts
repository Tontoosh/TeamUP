import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useApi<T>(path: string | null, interval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const fetchData = useCallback(async (silent = false) => {
    if (silent && request.current) return;
    request.current?.abort();
    const current = ++generation.current;
    if (!path) {
      request.current = null;
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const value = await api<T>(path, { signal: controller.signal });
      if (current === generation.current) {
        setData(value);
        setError('');
      }
    } catch (err) {
      if (!controller.signal.aborted && current === generation.current)
        setError((err as Error).message);
    } finally {
      if (current === generation.current) {
        request.current = null;
        setLoading(false);
      }
    }
  }, [path]);
  const reload = useCallback(() => fetchData(), [fetchData]);
  useEffect(() => {
    setLoading(true);
    setData(null);
    void reload();
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden) void fetchData(true);
        }, interval)
      : undefined;
    return () => {
      generation.current++;
      request.current?.abort();
      if (timer) clearInterval(timer);
    };
  }, [reload, fetchData, interval]);
  return { data, error, loading, reload };
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

// Keep text fields responsive and URLs shareable while limiting API requests.
// Selects and pagination remain immediate.
export function useDebouncedFilters(params: URLSearchParams, fields: string) {
  const textParams = new URLSearchParams();
  for (const key of fields.split(',')) {
    const value = params.get(key);
    if (value) textParams.set(key, value);
  }
  const settled = new URLSearchParams(useDebouncedValue(textParams.toString()));
  const query = new URLSearchParams(params);
  for (const key of fields.split(',')) {
    const value = settled.get(key)?.trim();
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return query;
}
