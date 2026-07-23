import { create } from 'zustand';

export type GameState = 'working' | 'resting';
export type TimeOfDay = 'day' | 'afternoon' | 'night';

export interface GameStore {
  /** Productivity signal — one per global key press while `working`. */
  traction: number;
  /** Reserved for Phase 3 economy loop. */
  capital: number;
  /** Whether keystrokes currently count toward traction. */
  gameState: GameState;
  /** Derived from the system clock by `useTimeSync`. */
  timeOfDay: TimeOfDay;

  // Actions
  incrementTraction: (by?: number) => void;
  addCapital: (amount: number) => void;
  setGameState: (gameState: GameState) => void;
  setTimeOfDay: (timeOfDay: TimeOfDay) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  traction: 0,
  capital: 0,
  gameState: 'working' as GameState,
  timeOfDay: 'day' as TimeOfDay,
};

export const useGameStore = create<GameStore>((set) => ({
  ...INITIAL_STATE,

  incrementTraction: (by = 1) =>
    set((state) => ({ traction: state.traction + by })),

  addCapital: (amount) => set((state) => ({ capital: state.capital + amount })),

  setGameState: (gameState) => set({ gameState }),

  // Skip the state write (and re-render) when the value hasn't changed —
  // useTimeSync calls this once a minute regardless.
  setTimeOfDay: (timeOfDay) =>
    set((state) => (state.timeOfDay === timeOfDay ? state : { timeOfDay })),

  reset: () => set(INITIAL_STATE),
}));
