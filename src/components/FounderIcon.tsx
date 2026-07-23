'use client';

import { useGameStore } from '../store/useGameStore';

// Flat geometric palette ------------------------------------------------------
const SKIN = '#f4c9a6';
const HAIR = '#2b221c';

const SHIRT_FILL: Record<string, string> = {
  'black-tee': '#1f2937', // neutral-800
  hoodie: '#4338ca', // indigo-700
};
const DEFAULT_SHIRT = '#e5e7eb';

// A single falling column of glyphs on the laptop screen. Deterministic chars
// (no Math.random in render) keep it stable across re-renders.
function MatrixColumn({ x, delay, duration }: { x: number; delay: number; duration: number }) {
  const chars = Array.from({ length: 12 }, (_, i) => ((x + i) % 2 === 0 ? '0' : '1'));
  return (
    <g style={{ animation: `founderMatrix ${duration}s linear ${delay}s infinite` }}>
      <text x={x} y={116} fill="#22c55e" fontSize="6" fontFamily="monospace">
        {/* Two stacked copies so the loop reads as continuous. */}
        {chars.map((c, i) => (
          <tspan key={`a${i}`} x={x} dy={i === 0 ? 0 : 6}>
            {c}
          </tspan>
        ))}
        {chars.map((c, i) => (
          <tspan key={`b${i}`} x={x} dy={6}>
            {c}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export default function FounderIcon() {
  const gameState = useGameStore((s) => s.gameState);
  const equippedHat = useGameStore((s) => s.equippedHat);
  const equippedShirt = useGameStore((s) => s.equippedShirt);
  const isMatrixActive = useGameStore((s) => s.isMatrixActive);

  const working = gameState === 'working';
  const resting = gameState === 'resting';
  const shirtColor = (equippedShirt && SHIRT_FILL[equippedShirt]) || DEFAULT_SHIRT;

  return (
    <svg
      viewBox="0 0 200 210"
      className="h-56 w-56"
      role="img"
      aria-label={`Founder, currently ${gameState}`}
    >
      <style>{`
        @keyframes founderTyping {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(2px); }
        }
        @keyframes founderNod {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(7deg); }
        }
        @keyframes founderMatrix {
          from { transform: translateY(-36px); }
          to   { transform: translateY(0); }
        }
        .founder-head { transform-box: fill-box; transform-origin: center bottom; }
        .founder-head--nod  { animation: founderNod 1.4s ease-in-out infinite; }
        .founder-hands--type { animation: founderTyping 0.28s ease-in-out infinite; }
      `}</style>

      <defs>
        <clipPath id="founder-screen">
          <rect x="72" y="112" width="56" height="34" rx="2" />
        </clipPath>
      </defs>

      {/* Torso / shirt */}
      {equippedShirt === 'hoodie' && (
        // Hood behind the neck
        <path d="M62 104 Q100 78 138 104 L138 120 L62 120 Z" fill={SHIRT_FILL.hoodie} />
      )}
      <rect x="58" y="96" width="84" height="80" rx="22" fill={shirtColor} />
      <rect x="92" y="80" width="16" height="20" fill={SKIN} />

      {/* Head group (nods while resting) */}
      <g className={`founder-head ${resting ? 'founder-head--nod' : ''}`}>
        {/* Hair cap behind the face */}
        <circle cx="100" cy="52" r="30" fill={HAIR} />
        <circle cx="100" cy="58" r="27" fill={SKIN} />
        {/* Eyes */}
        {resting ? (
          <>
            <rect x="86" y="58" width="9" height="3" rx="1.5" fill="#3b3b3b" />
            <rect x="105" y="58" width="9" height="3" rx="1.5" fill="#3b3b3b" />
          </>
        ) : (
          <>
            <circle cx="90" cy="59" r="2.6" fill="#3b3b3b" />
            <circle cx="110" cy="59" r="2.6" fill="#3b3b3b" />
          </>
        )}

        {/* Hats */}
        {equippedHat === 'cap' && (
          <g>
            <path d="M74 44 Q100 22 126 44 L126 50 L74 50 Z" fill="#dc2626" />
            <rect x="72" y="48" width="56" height="7" rx="3" fill="#b91c1c" />
            <rect x="122" y="49" width="26" height="6" rx="3" fill="#b91c1c" />
          </g>
        )}
        {equippedHat === 'beanie' && (
          <g>
            <path d="M74 46 Q100 18 126 46 Z" fill="#0ea5e9" />
            <rect x="72" y="42" width="56" height="9" rx="4" fill="#0284c7" />
          </g>
        )}

        {/* Headphones while resting */}
        {resting && (
          <g fill="#111827">
            <path d="M70 54 Q100 26 130 54" stroke="#111827" strokeWidth="6" fill="none" />
            <rect x="64" y="52" width="14" height="20" rx="5" />
            <rect x="122" y="52" width="14" height="20" rx="5" />
          </g>
        )}
      </g>

      {/* Laptop */}
      <g>
        {/* Screen frame */}
        <rect x="68" y="108" width="64" height="42" rx="4" fill="#374151" />
        {/* Display */}
        <rect x="72" y="112" width="56" height="34" rx="2" fill="#0b1220" />

        {isMatrixActive ? (
          <g clipPath="url(#founder-screen)">
            {[78, 88, 98, 108, 118].map((x, i) => (
              <MatrixColumn key={x} x={x} delay={i * 0.35} duration={1.6 + (i % 3) * 0.4} />
            ))}
          </g>
        ) : (
          // Idle "code editor" lines
          <g clipPath="url(#founder-screen)" opacity="0.8">
            <rect x="78" y="118" width="26" height="3" rx="1.5" fill="#64748b" />
            <rect x="78" y="125" width="40" height="3" rx="1.5" fill="#475569" />
            <rect x="78" y="132" width="20" height="3" rx="1.5" fill="#64748b" />
            <rect x="78" y="139" width="34" height="3" rx="1.5" fill="#475569" />
          </g>
        )}

        {/* Keyboard base */}
        <path d="M60 150 L140 150 L150 166 L50 166 Z" fill="#9ca3af" />
        <rect x="50" y="164" width="100" height="5" rx="2.5" fill="#6b7280" />

        {/* Hands (bounce while typing) */}
        <g className={working ? 'founder-hands--type' : ''}>
          <rect x="72" y="150" width="16" height="11" rx="5" fill={SKIN} />
          <rect x="112" y="150" width="16" height="11" rx="5" fill={SKIN} />
        </g>
      </g>
    </svg>
  );
}
