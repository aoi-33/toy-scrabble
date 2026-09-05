import type { Direction, PendingPlacement } from './types';

export function detectDirection(placements: PendingPlacement[]): Direction | null {
  if (placements.length === 0) return null;
  if (placements.length === 1) return 'H';
  const rows = new Set(placements.map(p => p.coord.r));
  const cols = new Set(placements.map(p => p.coord.c));
  if (rows.size === 1) return 'H';
  if (cols.size === 1) return 'V';
  return null;
}
