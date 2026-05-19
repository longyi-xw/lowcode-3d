//! Project-level Rust state: the path of the currently-open project folder.
//!
//! Owning this in Rust (instead of TS Zustand) means "where to save" is anchored
//! next to "how to save" — a single source of truth for the on-disk identity of
//! a project. The frontend reads/writes via the exposed commands.
//!
//! Concurrency: a Tokio task scheduler + std::sync::Mutex pair is enough here
//! because lock holds are trivial (assign/clone an `Option<PathBuf>`). No
//! `tokio::sync::Mutex` because we never `.await` inside the critical section.

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::State;

#[derive(Default)]
pub struct ProjectPath(pub Mutex<Option<PathBuf>>);

#[tauri::command]
#[specta::specta]
pub fn get_current_project_path(state: State<'_, ProjectPath>) -> Option<String> {
    state
        .0
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
#[specta::specta]
pub fn set_current_project_path(state: State<'_, ProjectPath>, path: Option<String>) {
    if let Ok(mut guard) = state.0.lock() {
        *guard = path.map(PathBuf::from);
    }
}
