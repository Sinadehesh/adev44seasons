import { create } from 'zustand';

export type GameState = 'working' | 'resting';
export type TimeOfDay = 'day' | 'afternoon' | 'night';
export type Rarity = 'common' | 'rare' | 'cosmetic' | 'legendary';

export interface PullResult {
  id: string;
  name: string;
  rarity: Rarity;
}

// ---------------------------------------------------------------------------
// Gacha configuration
// ---------------------------------------------------------------------------

export const LOOT_BOX_COST = 50;
export const REST_DURATION_MS = 10 * 60 * 1000; // 10 minutes

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
  traction: number;
  capital: number;
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
  incrementTraction: (by?: number) => void;
  addCapital: (amount: number) => void;
  setGameState: (gameState: GameState) => void;
  setTimeOfDay: (timeOfDay: TimeOfDay) => void;

  // Gacha / rest
  openLootBox: (options?: { free?: boolean }) => PullResult | null;
  startRest: (durationMs?: number) => void;
  endRest: () => void;

  // Cosmetics
  equipHat: (id: string | null) => void;
  equipShirt: (id: string | null) => void;
  setMatrixActive: (active: boolean) => void;
  toggleMatrix: () => void;

  reset: () => void;
}

const INITIAL_STATE = {
  traction: 0,
  capital: 150, // dev starting balance so the loot box is immediately testable
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

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  incrementTraction: (by = 1) =>
    set((state) => ({ traction: state.traction + by })),

  addCapital: (amount) => set((state) => ({ capital: state.capital + amount })),

  setGameState: (gameState) => set({ gameState }),

  setTimeOfDay: (timeOfDay) =>
    set((state) => (state.timeOfDay === timeOfDay ? state : { timeOfDay })),

  openLootBox: (options) => {
    const free = options?.free ?? false;
    const state = get();

    if (!free && state.capital < LOOT_BOX_COST) {
      return null; // can't afford
    }
    if (!free) {
      set({ capital: state.capital - LOOT_BOX_COST });
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

  reset: () => {
    if (restTimer) {
      clearTimeout(restTimer);
      restTimer = null;
    }
    set(INITIAL_STATE);
  },
}));
