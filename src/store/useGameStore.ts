import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type GameState = 'working' | 'resting';
export type TimeOfDay = 'day' | 'afternoon' | 'night';
export type Rarity = 'common' | 'rare' | 'cosmetic' | 'legendary';

export interface PullResult {
  id: string;
  name: string;
  rarity: Rarity;
}

// ---------------------------------------------------------------------------
// Economy configuration (Phase 4 / 5)
// ---------------------------------------------------------------------------

/** Gacha boxes now cost Traction (keystrokes), not Capital. */
export const LOOT_BOX_TRACTION_COST = 1_000;
export const REST_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// The Startup Revenue Curve: flat $0 until the threshold, then exponential.
export const REVENUE_THRESHOLD = 100_000;
export const REVENUE_BASE = 0.01;
export const REVENUE_GROWTH = 1.00005;

// Location tiers: each HQ upgrade multiplies exponential revenue.
export const LOCATIONS: Record<
  number,
  { name: string; revenueMultiplier: number }
> = {
  1: { name: 'Garage', revenueMultiplier: 1 },
  2: { name: 'Co-working Space', revenueMultiplier: 2 },
  3: { name: 'Penthouse', revenueMultiplier: 5 },
};

/** Capital cost to advance FROM the keyed tier to the next one. */
export const UPGRADE_COST: Record<number, number> = {
  1: 500_000,
  2: 10_000_000,
};

export const MAX_LOCATION_TIER = 3;

// The Black Swan: a rare crash whose damage scales with success — a random
// 40–120% of current Capital, or a flat $50k floor, whichever is larger.
export const BLACK_SWAN_CHANCE = 1 / 25_000;
const BLACK_SWAN_MIN_LOSS = 50_000;
const BLACK_SWAN_PCT_MIN = 0.4;
const BLACK_SWAN_PCT_RANGE = 0.8; // yields a 0.4 .. 1.2 multiplier

// ---------------------------------------------------------------------------
// Cosmetics / gacha tables
// ---------------------------------------------------------------------------

export const HATS = ['cap', 'beanie'] as const;
export const SHIRTS = ['black-tee', 'hoodie'] as const;
const COSMETICS = [...HATS, ...SHIRTS] as const;

export const ITEM_NAMES: Record<string, string> = {
  coffee: 'Coffee',
  cigarettes: 'Cigarettes',
  'red-bull': 'Red Bull',
  alcohol: 'Alcohol',
  cap: 'Cap',
  beanie: 'Beanie',
  'black-tee': 'Black Tee',
  hoodie: 'Hoodie',
  'matrix-theme': 'Matrix Theme',
};

export const isHat = (id: string): boolean => (HATS as readonly string[]).includes(id);
export const isShirt = (id: string): boolean => (SHIRTS as readonly string[]).includes(id);

function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// The rest countdown lives outside the store: a timer handle isn't render
// state, and keeping it out of Zustand avoids stale/duplicate timers.
let restTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface GameStore {
  /** Spendable traction (drained by gacha pulls). */
  traction: number;
  /** Permanent record of every keystroke — drives the revenue curve. */
  lifetimeTraction: number;
  /** Exponential, volatile success metric (money). Can go negative. */
  capital: number;
  /** HQ tier (1..3) — multiplies revenue and drives the UI theme. */
  locationTier: number;
  gameState: GameState;
  timeOfDay: TimeOfDay;

  // Inventory / cosmetics
  equippedHat: string | null;
  equippedShirt: string | null;
  unlockedCosmetics: string[];
  matrixThemeUnlocked: boolean;
  isMatrixActive: boolean;

  // Gacha
  lastPullResult: PullResult | null;
  /** Epoch ms when the current rest ends, or null when working. */
  restEndsAt: number | null;

  // Core actions
  addTraction: () => void;
  setGameState: (gameState: GameState) => void;
  setTimeOfDay: (timeOfDay: TimeOfDay) => void;
  upgradeLocation: () => void;

  // Gacha / rest
  openLootBox: (options?: { free?: boolean }) => PullResult | null;
  startRest: (durationMs?: number) => void;
  endRest: () => void;

  // Cosmetics
  equipHat: (id: string | null) => void;
  equipShirt: (id: string | null) => void;
  setMatrixActive: (active: boolean) => void;
  toggleMatrix: () => void;

  // Dev helper (no economy side effects) so the gacha / curve are testable.
  devAddTraction: (amount: number) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  traction: 0,
  lifetimeTraction: 0,
  capital: 0,
  locationTier: 1,
  gameState: 'working' as GameState,
  timeOfDay: 'day' as TimeOfDay,
  equippedHat: null as string | null,
  equippedShirt: null as string | null,
  unlockedCosmetics: [] as string[],
  matrixThemeUnlocked: false,
  isMatrixActive: false,
  lastPullResult: null as PullResult | null,
  restEndsAt: null as number | null,
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // Runs once per keystroke. Kept to a single `set` with a couple of cheap
      // math ops (one Math.pow + one Math.random) so it won't stutter under a
      // fast typist.
      addTraction: () =>
        set((state) => {
          const traction = state.traction + 1;
          const lifetimeTraction = state.lifetimeTraction + 1;
          let capital = state.capital;

          // The Hockey Stick: exponential revenue once past the threshold,
          // scaled by the current HQ tier's multiplier (1x / 2x / 5x).
          if (lifetimeTraction >= REVENUE_THRESHOLD) {
            const multiplier = LOCATIONS[state.locationTier]?.revenueMultiplier ?? 1;
            capital +=
              multiplier *
              REVENUE_BASE *
              Math.pow(REVENUE_GROWTH, lifetimeTraction - REVENUE_THRESHOLD);
          }

          // The Black Swan: 1-in-25,000 market crash, scaled to success.
          if (Math.random() < BLACK_SWAN_CHANCE) {
            const loss = Math.max(
              BLACK_SWAN_MIN_LOSS,
              capital * (BLACK_SWAN_PCT_MIN + Math.random() * BLACK_SWAN_PCT_RANGE),
            );
            capital -= loss;
          }

          return { traction, lifetimeTraction, capital };
        }),

      setGameState: (gameState) => set({ gameState }),

      setTimeOfDay: (timeOfDay) =>
        set((state) => (state.timeOfDay === timeOfDay ? state : { timeOfDay })),

      upgradeLocation: () =>
        set((state) => {
          const cost = UPGRADE_COST[state.locationTier];
          if (cost === undefined || state.capital < cost) {
            return state; // maxed out or can't afford
          }
          return { capital: state.capital - cost, locationTier: state.locationTier + 1 };
        }),

      openLootBox: (options) => {
        const free = options?.free ?? false;
        const state = get();

        if (!free && state.traction < LOOT_BOX_TRACTION_COST) {
          return null; // not enough traction
        }
        if (!free) {
          set({ traction: state.traction - LOOT_BOX_TRACTION_COST });
        }

        const isDay = state.timeOfDay === 'day';
        const roll = Math.random();
        let result: PullResult;

        if (roll < 0.6) {
          // 60% Common — daytime pick-me-up vs. after-hours vice.
          const id = isDay ? 'coffee' : 'cigarettes';
          result = { id, name: ITEM_NAMES[id], rarity: 'common' };
        } else if (roll < 0.85) {
          // 25% Rare
          const id = isDay ? 'red-bull' : 'alcohol';
          result = { id, name: ITEM_NAMES[id], rarity: 'rare' };
        } else if (roll < 0.95) {
          // 10% Cosmetic — a random hat or shirt.
          const id = randomFrom(COSMETICS);
          result = { id, name: ITEM_NAMES[id], rarity: 'cosmetic' };
        } else {
          // 5% Legendary
          result = { id: 'matrix-theme', name: ITEM_NAMES['matrix-theme'], rarity: 'legendary' };
        }

        // Persist unlocks + record the pull for the unboxing UI.
        set((s) => {
          const patch: Partial<GameStore> = { lastPullResult: result };
          const isUnlock = result.rarity === 'cosmetic' || result.rarity === 'legendary';
          if (isUnlock && !s.unlockedCosmetics.includes(result.id)) {
            patch.unlockedCosmetics = [...s.unlockedCosmetics, result.id];
          }
          if (result.id === 'matrix-theme') {
            patch.matrixThemeUnlocked = true;
          }
          return patch;
        });

        // Vices force a Pomodoro-style break.
        if (result.id === 'cigarettes' || result.id === 'alcohol') {
          get().startRest();
        }

        return result;
      },

      startRest: (durationMs = REST_DURATION_MS) => {
        if (restTimer) clearTimeout(restTimer);
        set({ gameState: 'resting', restEndsAt: Date.now() + durationMs });
        restTimer = setTimeout(() => {
          restTimer = null;
          set({ gameState: 'working', restEndsAt: null });
        }, durationMs);
      },

      endRest: () => {
        if (restTimer) {
          clearTimeout(restTimer);
          restTimer = null;
        }
        set({ gameState: 'working', restEndsAt: null });
      },

      equipHat: (id) => set({ equippedHat: id }),
      equipShirt: (id) => set({ equippedShirt: id }),

      setMatrixActive: (active) =>
        set((s) => (s.matrixThemeUnlocked ? { isMatrixActive: active } : s)),

      toggleMatrix: () =>
        set((s) => (s.matrixThemeUnlocked ? { isMatrixActive: !s.isMatrixActive } : s)),

      devAddTraction: (amount) =>
        set((state) => ({
          traction: state.traction + amount,
          lifetimeTraction: state.lifetimeTraction + amount,
        })),

      reset: () => {
        if (restTimer) {
          clearTimeout(restTimer);
          restTimer = null;
        }
        set(INITIAL_STATE);
      },
    }),
    {
      name: 'startup-idle-save',
      // Tauri's WebView2 persists localStorage across app restarts.
      storage: createJSONStorage(() => localStorage),
      // Persist only durable save data. Transient runtime state (gameState,
      // restEndsAt, lastPullResult) is intentionally excluded so a reload can
      // never restore a stuck 'resting' state with no live countdown timer.
      partialize: (state) => ({
        traction: state.traction,
        lifetimeTraction: state.lifetimeTraction,
        capital: state.capital,
        locationTier: state.locationTier,
        equippedHat: state.equippedHat,
        equippedShirt: state.equippedShirt,
        unlockedCosmetics: state.unlockedCosmetics,
        matrixThemeUnlocked: state.matrixThemeUnlocked,
        isMatrixActive: state.isMatrixActive,
      }),
    },
  ),
);
