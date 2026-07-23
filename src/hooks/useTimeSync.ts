'use client';

import { useEffect } from 'react';
import { useGameStore, type TimeOfDay } from '../store/useGameStore';

/**
 * Maps a wall-clock time to a time-of-day bucket.
 *   06:00–14:00 → 'day'
 *   14:00–20:00 → 'afternoon'
 *   20:00–06:00 → 'night'
 */
export function computeTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 6 && hour < 14) return 'day';
  if (hour >= 14 && hour < 20) return 'afternoon';
  return 'night';
}

/**
 * Keeps `timeOfDay` in the game store aligned with the system clock: once on
 * mount, then re-checked every `intervalMs` (default 60s).
 */
export function useTimeSync(intervalMs = 60_000): void {
  const setTimeOfDay = useGameStore((state) => state.setTimeOfDay);

  useEffect(() => {
    const sync = () => setTimeOfDay(computeTimeOfDay());

    sync(); // run immediately on mount
    const id = setInterval(sync, intervalMs);
    return () => clearInterval(id);
  }, [setTimeOfDay, intervalMs]);
}
