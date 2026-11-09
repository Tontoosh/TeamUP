export async function api<T = { ok: boolean }>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Алдаа гарлаа. Дахин оролдоно уу.');
  return data;
}
export const post = <T = { ok: boolean }>(path: string, data: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
export const patch = <T = { ok: boolean }>(path: string, data: unknown = {}) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
export const date = (value: string) =>
  new Intl.DateTimeFormat('mn-MN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
export const splitList = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  ),
];
