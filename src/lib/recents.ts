const KEY = 'frieren-recent-items';

export function rememberRecent (keys: string[], key: string): string[] {
  return [key, ...keys.filter(value => value !== key)].slice(0, 32);
}

export function loadRecents (): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(saved)) return [...new Set(saved.filter((value): value is string => typeof value === 'string' && value.length > 0))].slice(0, 32);
    const previous = localStorage.getItem('frieren-last-used');
    return previous ? [previous] : [];
  } catch { return []; }
}

export function saveRecents (keys: string[]): void { localStorage.setItem(KEY, JSON.stringify(keys)); }

export function recentItems<T> (items: T[], keys: string[], keyOf: (item: T) => string): T[] {
  const available = new Map(items.map(item => [keyOf(item), item]));
  const ordered = [...new Set([...keys, ...items.map(keyOf)])];
  return ordered.filter(key => available.has(key)).slice(0, 6).map(key => available.get(key)!);
}
