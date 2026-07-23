use tauri::{AppHandle, Emitter};

/// The event name the frontend subscribes to. Kept as a constant so the Rust
/// and TypeScript sides stay in sync via a single source of truth.
const KEYSTROKE_EVENT: &str = "keystroke_detected";

/// Spawns a dedicated background thread that listens for global OS keyboard
/// events and emits a lightweight [`KEYSTROKE_EVENT`] to the frontend on every
/// key press.
///
/// `rdev::listen` blocks for the lifetime of the process, so it must run off
/// the main (UI) thread. The payload is intentionally empty: Phase 1 only needs
/// a "a key was pressed" trigger, which keeps the hot path cheap and avoids
/// shipping actual keystrokes across the IPC boundary.
fn spawn_keystroke_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let callback = move |event: rdev::Event| {
            if let rdev::EventType::KeyPress(_) = event.event_type {
                // Fire-and-forget: an emit can fail during shutdown when the
                // window is already gone, which is not a fatal condition.
                let _ = app.emit(KEYSTROKE_EVENT, ());
            }
        };

        if let Err(error) = rdev::listen(callback) {
            eprintln!("global keystroke listener error: {error:?}");
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_keystroke_listener(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
