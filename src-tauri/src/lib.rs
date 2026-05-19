use std::path::PathBuf;

use specta_typescript::Typescript;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;
use tauri_specta::{collect_commands, Builder};

mod project_io;
mod project_state;

use project_io::{open_project_folder, save_project_folder};
use project_state::{get_current_project_path, set_current_project_path, ProjectPath};

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        save_project_folder,
        open_project_folder,
        get_current_project_path,
        set_current_project_path,
    ])
}

/// Absolute path of the generated bindings file. Computed from
/// `CARGO_MANIFEST_DIR` (set at compile time) so the binding writer doesn't
/// depend on the process working directory — `pnpm bindings` runs from the
/// repo root and `pnpm tauri dev` runs from `src-tauri/`, and both have to land
/// in the same place.
fn bindings_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("bindings")
        .join("tauri.ts")
}

/// Standalone entry point so `pnpm bindings` can refresh the TypeScript file
/// without launching the GUI window.
pub fn export_bindings() -> Result<(), specta_typescript::Error> {
    specta_builder().export(Typescript::default(), bindings_path())
}

/// Build the application menu. macOS shows it in the system menu bar; other
/// platforms attach it to the window. Items emit a `menu` event carrying the
/// item id — frontend listens with `listen('menu', e => …)` and dispatches.
fn build_menu<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let new_item = MenuItemBuilder::with_id("file:new", "New Project")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_item = MenuItemBuilder::with_id("file:open", "Open Project…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save_item = MenuItemBuilder::with_id("file:save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as_item = MenuItemBuilder::with_id("file:save_as", "Save As…")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let close_item = MenuItemBuilder::with_id("file:close", "Close Project")
        .accelerator("CmdOrCtrl+W")
        .build(app)?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&new_item)
        .item(&open_item)
        .separator()
        .item(&save_item)
        .item(&save_as_item)
        .separator()
        .item(&close_item)
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    MenuBuilder::new(app).items(&[&file, &edit]).build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    // Dev safety net: regenerate bindings on every debug-mode launch in case
    // someone forgets `pnpm bindings`.
    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), bindings_path())
        .expect("failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(ProjectPath::default())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(move |app, event| {
                let id = event.id().as_ref().to_string();
                let _ = app.emit("menu", id);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
