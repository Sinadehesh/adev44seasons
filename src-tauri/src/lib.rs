use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

/// The event name the frontend subscribes to. Kept as a constant so the Rust
/// and TypeScript sides stay in sync via a single source of truth.
const KEYSTROKE_EVENT: &str = "keystroke_detected";

/// The label of the main window as declared in `tauri.conf.json`.
const MAIN_WINDOW: &str = "main";

/// Spawns a dedicated background thread that listens for global OS keyboard
/// events and emits a lightweight [`KEYSTROKE_EVENT`] to the frontend on every
/// key press.
///
/// `rdev::listen` blocks for the lifetime of the process, so it must run off
/// the main (UI) thread. The payload is intentionally empty: it's only a
/// "a key was pressed" trigger, which keeps the hot path cheap and avoids
/// shipping actual keystrokes across the IPC boundary. Because the window is
/// merely hidden (never destroyed) on close, this listener keeps running while
/// the app lives in the system tray.
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

/// Show + focus the main window if it's hidden, or hide it if it's visible.
fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_keystroke_listener(app.handle().clone());

            // System tray: reuse the app's default icon and attach a small menu.
            let toggle_item =
                MenuItem::with_id(app, "toggle", "Toggle Visibility", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().expect("app has a default icon").clone())
                .tooltip("adev44seasons")
                .menu(&menu)
                // Left click toggles the window; the menu opens on right click.
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Intercept the window 'X': hide instead of quitting so the global
            // keystroke listener keeps running in the background. The app only
            // truly exits via the tray's "Quit" item (app.exit).
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
