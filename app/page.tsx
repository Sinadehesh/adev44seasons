'use client';

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useGameStore, type TimeOfDay } from '../src/store/useGameStore';
import { useTimeSync } from '../src/hooks/useTimeSync';

// Per-time-of-day palette. `transition-colors duration-1000` on the container
// makes the swap between these a slow, ambient fade.
const THEME: Record<
  TimeOfDay,
  { bg: string; text: string; muted: string; label: string }
> = {
  day: {
    bg: 'bg-amber-100',
    text: 'text-amber-950',
    muted: 'text-amber-700',
    label: 'Day',
  },
  afternoon: {
    bg: 'bg-orange-500',
    text: 'text-orange-50',
    muted: 'text-orange-100',
    label: 'Afternoon',
  },
  night: {
    bg: 'bg-neutral-950',
    text: 'text-neutral-100',
    muted: 'text-neutral-500',
    label: 'Night',
  },
};

export default function Home() {
  const traction = useGameStore((state) => state.traction);
  const timeOfDay = useGameStore((state) => state.timeOfDay);
  const incrementTraction = useGameStore((state) => state.incrementTraction);

  // Keep the environment time in sync with the system clock.
  useTimeSync();

  useEffect(() => {
    const unlistenPromise = listen('keystroke_detected', () => {
      // Read the live gameState at event time (via getState) so we don't
      // re-register the listener whenever gameState toggles.
      if (useGameStore.getState().gameState === 'working') {
        incrementTraction();
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [incrementTraction]);

  const theme = THEME[timeOfDay];

  return (
    <main
      className={`flex min-h-screen select-none flex-col items-center justify-center gap-4 transition-colors duration-1000 ${theme.bg} ${theme.text}`}
    >
      <span className={`text-xs uppercase tracking-[0.35em] ${theme.muted}`}>
        traction
      </span>
      <span className="font-mono text-8xl font-semibold tabular-nums leading-none">
        {traction}
      </span>
      <span className={`text-[0.7rem] uppercase tracking-[0.3em] ${theme.muted}`}>
        {theme.label}
      </span>
    </main>
  );
}
