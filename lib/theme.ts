export const AVATAR_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;

export const colors = {
  bg: '#ffffff',
  surface: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  muted: '#71717a',
  accent: '#4f46e5',
  danger: '#dc2626',
};

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}
