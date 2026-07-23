# adev44seasons — Phase 1

A lightweight desktop **background productivity companion**. Phase 1 ships the
core primitive: an **OS-level global keystroke listener** written in Rust that
emits a signal to a Next.js frontend on every key press — even when the app
window is out of focus. The frontend increments a `traction` counter for each
signal.

- **Frontend:** Next.js (App Router) · React · TypeScript · Tailwind CSS
- **Shell/Backend:** Tauri v2 · Rust
- **Global listener:** [`rdev`](https://crates.io/crates/rdev)

The event payload is intentionally **empty** — it's a pure "a key was pressed"
trigger. No keystrokes cross the IPC boundary, keeping the hot path cheap.

---

## Prerequisites

- **Node.js** ≥ 18 and npm
- **Rust** (stable) via [rustup](https://rustup.rs)
- Tauri v2 system dependencies for your OS — see
  <https://tauri.app/start/prerequisites/>
  (Linux notably needs `webkit2gtk-4.1` and friends.)

## Run it

```bash
npm install
npm run tauri dev
```

`tauri dev` runs `npm run dev` (Next.js on `http://localhost:3000`) and opens
the native window. Type anywhere on your machine — the counter climbs even when
the window is not focused.

## Build a release bundle

```bash
npm run tauri build
```

---

## Platform notes for the global listener

`rdev` taps OS-level input APIs, which require permissions on some platforms:

- **macOS:** grant the app **Accessibility** permission
  (*System Settings → Privacy & Security → Accessibility*). Without it, no
  key events are delivered. During `dev` you may need to grant it to your
  terminal.
- **Linux:** works under X11. Wayland restricts global input capture, so
  results vary by compositor.
- **Windows:** works out of the box.

---

## How it was scaffolded

This project was assembled to match the standard `create-tauri-app` layout. The
equivalent interactive command is:

```bash
npm create tauri-app@latest adev44seasons -- \
  --template nextjs --manager npm --yes
```

Then `rdev` was added to `src-tauri/Cargo.toml` and the listener wired into
`src-tauri/src/lib.rs`. No global-state crate (e.g. `lazy_static`) is needed:
the `AppHandle` is cloned directly into the listener thread's closure.

## Project layout

```
.
├── app/                    # Next.js App Router
│   ├── globals.css         # Tailwind entry
│   ├── layout.tsx          # Root layout (dark mode)
│   └── page.tsx            # Client component — listens & counts `traction`
├── src-tauri/
│   ├── Cargo.toml          # Rust deps (tauri, rdev)
│   ├── build.rs
│   ├── tauri.conf.json     # Window + bundle config
│   ├── capabilities/
│   │   └── default.json    # Grants event IPC (core:default)
│   └── src/
│       ├── main.rs         # Binary entry point
│       └── lib.rs          # Listener thread + `keystroke_detected` emit
├── next.config.js          # Static export (output: 'export')
├── tailwind.config.ts
└── package.json
```
