'use client';

import { useEffect, useReducer, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  useGameStore,
  isHat,
  isShirt,
  ITEM_NAMES,
  LOOT_BOX_TRACTION_COST,
  LOCATIONS,
  UPGRADE_COST,
  MAX_LOCATION_TIER,
  type Rarity,
  type TimeOfDay,
} from '../src/store/useGameStore';
import { useTimeSync } from '../src/hooks/useTimeSync';
import FounderIcon from '../src/components/FounderIcon';

// Theme palette nested by location tier, then time of day (Phase 2 + 6).
// `dark` drives the derived muted/panel overlays so they read on any bg.
type ThemeEntry = { bg: string; text: string; label: string; dark: boolean };

const THEME_MAP: Record<number, Record<TimeOfDay, ThemeEntry>> = {
  1: {
    day: { bg: 'bg-amber-100', text: 'text-amber-900', label: 'Day', dark: false },
    afternoon: { bg: 'bg-orange-200', text: 'text-orange-950', label: 'Afternoon', dark: false },
    night: { bg: 'bg-neutral-950', text: 'text-neutral-200', label: 'Night', dark: true },
  },
  2: {
    day: { bg: 'bg-sky-100', text: 'text-sky-900', label: 'Day', dark: false },
    afternoon: { bg: 'bg-indigo-200', text: 'text-indigo-950', label: 'Afternoon', dark: false },
    night: { bg: 'bg-slate-900', text: 'text-slate-200', label: 'Night', dark: true },
  },
  3: {
    day: { bg: 'bg-zinc-100', text: 'text-zinc-900', label: 'Day', dark: false },
    afternoon: { bg: 'bg-gray-300', text: 'text-gray-900', label: 'Afternoon', dark: false },
    night: { bg: 'bg-black', text: 'text-zinc-400', label: 'Night', dark: true },
  },
};

const RARITY_BADGE: Record<Rarity, { label: string; className: string }> = {
  common: { label: 'Common', className: 'bg-neutral-500 text-white' },
  rare: { label: 'Rare', className: 'bg-sky-600 text-white' },
  cosmetic: { label: 'Cosmetic', className: 'bg-fuchsia-600 text-white' },
  legendary: { label: 'Legendary', className: 'bg-amber-400 text-amber-950' },
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

// Whole-dollar variant for upgrade costs (e.g. "$500,000").
const CURRENCY0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function Home() {
  const traction = useGameStore((s) => s.traction);
  const capital = useGameStore((s) => s.capital);
  const locationTier = useGameStore((s) => s.locationTier);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const gameState = useGameStore((s) => s.gameState);
  const restEndsAt = useGameStore((s) => s.restEndsAt);
  const unlockedCosmetics = useGameStore((s) => s.unlockedCosmetics);
  const equippedHat = useGameStore((s) => s.equippedHat);
  const equippedShirt = useGameStore((s) => s.equippedShirt);
  const matrixThemeUnlocked = useGameStore((s) => s.matrixThemeUnlocked);
  const isMatrixActive = useGameStore((s) => s.isMatrixActive);

  const addTraction = useGameStore((s) => s.addTraction);
  const openLootBox = useGameStore((s) => s.openLootBox);
  const devAddTraction = useGameStore((s) => s.devAddTraction);
  const upgradeLocation = useGameStore((s) => s.upgradeLocation);
  const equipHat = useGameStore((s) => s.equipHat);
  const equipShirt = useGameStore((s) => s.equipShirt);
  const toggleMatrix = useGameStore((s) => s.toggleMatrix);

  const [closetOpen, setClosetOpen] = useState(false);
  const [unbox, setUnbox] = useState<{ id: string; name: string; rarity: Rarity } | null>(null);

  // Hydration guard: the persisted store rehydrates from localStorage only on
  // the client, so the first client render must match the static HTML (initial
  // state). We render a loading screen until mounted, then paint the save.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useTimeSync();

  // Global keystroke listener — only counts while working.
  useEffect(() => {
    const unlistenPromise = listen('keystroke_detected', () => {
      if (useGameStore.getState().gameState === 'working') {
        addTraction();
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [addTraction]);

  // Tick once a second while resting so the countdown updates.
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (restEndsAt == null) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restEndsAt]);

  const theme = (THEME_MAP[locationTier] ?? THEME_MAP[1])[timeOfDay];
  const muted = theme.dark ? 'text-white/50' : 'text-black/50';
  const panel = theme.dark ? 'bg-white/10' : 'bg-black/10';
  const hats = unlockedCosmetics.filter(isHat);
  const shirts = unlockedCosmetics.filter(isShirt);
  const canOpenBox = traction >= LOOT_BOX_TRACTION_COST;

  const location = LOCATIONS[locationTier];
  const isMaxTier = locationTier >= MAX_LOCATION_TIER;
  const upgradeCost = UPGRADE_COST[locationTier];
  const nextLocation = LOCATIONS[locationTier + 1];
  const canUpgrade = !isMaxTier && upgradeCost !== undefined && capital >= upgradeCost;

  // $0 → dim gray, positive → green, negative → harsh red (debt).
  const capitalColor =
    capital === 0
      ? 'text-neutral-500'
      : capital > 0
        ? 'text-emerald-500'
        : 'text-red-500 font-bold';

  const handleOpenBox = () => {
    const result = openLootBox();
    if (result) setUnbox(result);
  };

  // Before hydration, render a minimalist boot screen so Next.js' static HTML
  // and the first client render agree (prevents a hydration mismatch).
  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-600">
        <span className="animate-pulse font-mono text-sm tracking-[0.4em]">
          Booting OS…
        </span>
      </main>
    );
  }

  return (
    <main
      className={`relative flex min-h-screen select-none flex-col items-center justify-center gap-6 px-6 transition-colors duration-1000 ${theme.bg} ${theme.text}`}
    >
      {/* Location + environment label */}
      <span className={`text-[0.7rem] uppercase tracking-[0.35em] ${muted}`}>
        {location.name} · {theme.label}
        {gameState === 'resting' && restEndsAt != null && (
          <> · resting {formatRemaining(restEndsAt - Date.now())}</>
        )}
      </span>

      <FounderIcon />

      {/* Capital — the exponential, volatile success metric. */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={`font-mono text-4xl font-semibold tabular-nums leading-none transition-colors duration-300 ${capitalColor}`}
        >
          {CURRENCY.format(capital)}
        </span>
        <span className={`text-[0.65rem] uppercase tracking-[0.35em] ${muted}`}>
          capital
        </span>
      </div>

      {/* Traction */}
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-6xl font-semibold tabular-nums leading-none">
          {traction}
        </span>
        <span className={`text-xs uppercase tracking-[0.35em] ${muted}`}>traction</span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleOpenBox}
          disabled={!canOpenBox}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity ${panel} enabled:hover:opacity-80 disabled:opacity-40`}
        >
          Open Box · {LOOT_BOX_TRACTION_COST.toLocaleString()} traction
        </button>
        <button
          type="button"
          onClick={() => setClosetOpen((v) => !v)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity ${panel} hover:opacity-80`}
        >
          Closet
        </button>
        {isMaxTier ? (
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${panel} opacity-70`}
          >
            Max Tier Reached
          </span>
        ) : (
          <button
            type="button"
            onClick={upgradeLocation}
            disabled={!canUpgrade}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-opacity ${panel} enabled:hover:opacity-80 disabled:opacity-40`}
          >
            Upgrade to {nextLocation.name}: {CURRENCY0.format(upgradeCost)}
          </button>
        )}
        {/* Dev helper: bulk traction so the gacha + revenue curve are testable
            without physically typing 100k keystrokes. */}
        <button
          type="button"
          onClick={() => devAddTraction(10_000)}
          className={`rounded-full px-3 py-1.5 text-xs ${panel} hover:opacity-80`}
        >
          +10k traction
        </button>
      </div>

      {/* Closet */}
      {closetOpen && (
        <div className={`w-full max-w-sm rounded-2xl p-4 text-sm ${panel}`}>
          <ClosetSection
            title="Hats"
            items={hats}
            equipped={equippedHat}
            onEquip={equipHat}
            muted={muted}
          />
          <ClosetSection
            title="Shirts"
            items={shirts}
            equipped={equippedShirt}
            onEquip={equipShirt}
            muted={muted}
          />
          {matrixThemeUnlocked && (
            <div className="mt-3 flex items-center justify-between">
              <span className={muted}>Matrix theme</span>
              <button
                type="button"
                onClick={toggleMatrix}
                className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:opacity-80"
              >
                {isMatrixActive ? 'On' : 'Off'}
              </button>
            </div>
          )}
          {hats.length === 0 && shirts.length === 0 && !matrixThemeUnlocked && (
            <p className={`text-xs ${muted}`}>
              No cosmetics yet — open some boxes.
            </p>
          )}
        </div>
      )}

      {/* Unboxing modal */}
      {unbox && (
        <div
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-6"
          onClick={() => setUnbox(null)}
        >
          <div
            className="flex flex-col items-center gap-3 rounded-3xl bg-neutral-900 px-10 py-8 text-neutral-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={`rounded-full px-3 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest ${RARITY_BADGE[unbox.rarity].className}`}
            >
              {RARITY_BADGE[unbox.rarity].label}
            </span>
            <span className="text-2xl font-semibold">{unbox.name}</span>
            <span className="text-xs text-neutral-400">
              {unbox.rarity === 'cosmetic' || unbox.rarity === 'legendary'
                ? 'Added to your closet'
                : unbox.id === 'cigarettes' || unbox.id === 'alcohol'
                  ? 'Time for a 10-minute break…'
                  : 'A little pick-me-up'}
            </span>
            <button
              type="button"
              onClick={() => setUnbox(null)}
              className="mt-1 rounded-full bg-neutral-700 px-5 py-1.5 text-sm font-medium hover:bg-neutral-600"
            >
              Nice
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ClosetSection({
  title,
  items,
  equipped,
  onEquip,
  muted,
}: {
  title: string;
  items: string[];
  equipped: string | null;
  onEquip: (id: string | null) => void;
  muted: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className={`mb-1.5 text-xs uppercase tracking-widest ${muted}`}>{title}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEquip(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            equipped === null
              ? 'bg-neutral-500/40 font-semibold'
              : 'bg-neutral-500/15 hover:bg-neutral-500/25'
          }`}
        >
          None
        </button>
        {items.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onEquip(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              equipped === id
                ? 'bg-neutral-500/40 font-semibold'
                : 'bg-neutral-500/15 hover:bg-neutral-500/25'
            }`}
          >
            {ITEM_NAMES[id] ?? id}
          </button>
        ))}
      </div>
    </div>
  );
}
