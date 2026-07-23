'use client';

import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';

export default function Home() {
  const [traction, setTraction] = useState(0);

  useEffect(() => {
    // Subscribe to the global keystroke signal emitted by the Rust backend.
    // The event carries no payload — it's a pure "a key was pressed" trigger.
    const unlistenPromise = listen('keystroke_detected', () => {
      setTraction((prev) => prev + 1);
    });

    // Tear down the listener when the component unmounts to avoid duplicates
    // (e.g. across fast-refresh in dev).
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <main className="flex min-h-screen select-none flex-col items-center justify-center gap-4">
      <span className="text-xs uppercase tracking-[0.35em] text-neutral-500">
        traction
      </span>
      <span className="font-mono text-8xl font-semibold tabular-nums leading-none">
        {traction}
      </span>
      <span className="text-[0.7rem] text-neutral-600">
        listening globally — window focus not required
      </span>
    </main>
  );
}
