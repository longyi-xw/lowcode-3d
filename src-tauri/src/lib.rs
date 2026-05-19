use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

/// Smoke-test command so the binding-generation pipeline can be verified before
/// real I/O commands land in PR B2. Removable once `save_project_folder` /
/// `open_project_folder` exist.
#[tauri::command]
#[specta::specta]
fn ping() -> String {
    "pong".into()
}

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![ping])
}

/// Public entry point for the standalone `generate-bindings` binary so
/// `pnpm bindings` can refresh the TypeScript file without launching the GUI.
pub fn export_bindings() -> Result<(), specta_typescript::Error> {
    specta_builder().export(Typescript::default(), "../src/bindings/tauri.ts")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    // Safety net: also regenerate bindings on every debug-mode launch in case
    // someone forgets to run `pnpm bindings`. Release builds skip this so the
    // shipped binary never tries to write outside its install dir.
    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings/tauri.ts")
        .expect("failed to export TypeScript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
