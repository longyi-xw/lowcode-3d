//! Export command — writes a generated project (text files + asset copies)
//! to a user-chosen destination directory.
//!
//! The frontend ships an `ExportPayload`:
//!   - `text_files`: relative path → file content (UTF-8 strings)
//!   - `asset_copies`: relative path → source-project-relative path that
//!     resolves under `source_project_path`
//!
//! Algorithm:
//!   1. Validate destination: must not be inside the source project (avoid
//!      writing into the active editor's folder), must be a directory or
//!      not exist yet.
//!   2. Stage everything in a sibling `.{name}.lowcode-export-tmp-{ts}` dir.
//!   3. For each text file, write bytes verbatim.
//!   4. For each asset copy, hardlink (O(1)) or fall back to byte copy.
//!   5. If destination already exists, rename it to a `.bak-{ts}` sibling
//!      (so failure mid-swap doesn't leave the user without their old
//!      output). Otherwise just rename tmp into place.
//!   6. On success, remove the backup. On failure, restore it.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::project_io::FolderError;

#[derive(Debug, Deserialize, Type)]
pub struct ExportPayload {
    pub source_project_path: String,
    pub destination_path: String,
    pub text_files: HashMap<String, String>,
    pub asset_copies: HashMap<String, String>,
}

#[derive(Debug, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub struct ExportSummary {
    pub destination_path: String,
    pub text_file_count: u32,
    pub asset_file_count: u32,
}

fn ts_suffix() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| format!("{}-{}", d.as_secs(), d.subsec_nanos()))
        .unwrap_or_else(|_| "0".into())
}

fn validate_relative_path(rel: &str) -> Result<(), FolderError> {
    if rel.starts_with('/') || rel.split('/').any(|seg| seg == ".." || seg.is_empty()) {
        return Err(FolderError::Io {
            path: rel.into(),
            message: "relative paths only — no leading / or .. segments".into(),
        });
    }
    Ok(())
}

fn is_inside(child: &Path, parent: &Path) -> bool {
    // The destination may not exist yet, so canonicalizing it directly
    // fails. Resolve its parent (which must exist, otherwise we'd have
    // failed elsewhere) and re-join the filename so the comparison is
    // against fully resolved paths — important on macOS where /tmp is a
    // symlink to /private/tmp and naive starts_with would miss matches.
    fn resolve(p: &Path) -> Option<PathBuf> {
        if let Ok(real) = fs::canonicalize(p) {
            return Some(real);
        }
        let parent = p.parent()?;
        let name = p.file_name()?;
        let real_parent = fs::canonicalize(parent).ok()?;
        Some(real_parent.join(name))
    }

    let (Some(c), Some(p)) = (resolve(child), resolve(parent)) else {
        return false;
    };
    c.starts_with(&p)
}

#[tauri::command]
#[specta::specta]
pub fn write_export_files(payload: ExportPayload) -> Result<ExportSummary, FolderError> {
    let destination = PathBuf::from(&payload.destination_path);
    let source_project = PathBuf::from(&payload.source_project_path);

    if !source_project.is_dir() {
        return Err(FolderError::Io {
            path: payload.source_project_path.clone(),
            message: "source project path is not a directory".into(),
        });
    }

    // Refuse to export *into* the source project — this would scribble over
    // the user's project.json / scene/. The editor side picks a directory
    // through the OS dialog so the only way this fires is via a misuse.
    if is_inside(&destination, &source_project) {
        return Err(FolderError::Io {
            path: payload.destination_path.clone(),
            message: "destination is inside the source project — pick another directory".into(),
        });
    }

    if destination.exists() && !destination.is_dir() {
        return Err(FolderError::NotADirectory {
            path: payload.destination_path.clone(),
        });
    }

    let parent = destination.parent().ok_or_else(|| FolderError::Io {
        path: payload.destination_path.clone(),
        message: "destination has no parent directory".into(),
    })?;
    let stem = destination
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "export".into());
    let ts = ts_suffix();
    let tmp = parent.join(format!(".{stem}.lowcode-export-tmp-{ts}"));
    let bak = parent.join(format!(".{stem}.lowcode-export-bak-{ts}"));

    fs::create_dir_all(&tmp).map_err(|e| FolderError::io(&tmp, e))?;

    if let Err(e) = stage_into(&tmp, &source_project, &payload) {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }

    let destination_existed = destination.exists();
    if destination_existed {
        if let Err(e) = fs::rename(&destination, &bak) {
            let _ = fs::remove_dir_all(&tmp);
            return Err(FolderError::io(&destination, e));
        }
    }
    if let Err(e) = fs::rename(&tmp, &destination) {
        if destination_existed {
            let _ = fs::rename(&bak, &destination);
        }
        let _ = fs::remove_dir_all(&tmp);
        return Err(FolderError::io(&destination, e));
    }
    if destination_existed {
        let _ = fs::remove_dir_all(&bak);
    }

    Ok(ExportSummary {
        destination_path: payload.destination_path,
        text_file_count: payload.text_files.len() as u32,
        asset_file_count: payload.asset_copies.len() as u32,
    })
}

fn stage_into(
    tmp: &Path,
    source_project: &Path,
    payload: &ExportPayload,
) -> Result<(), FolderError> {
    for (rel, content) in &payload.text_files {
        validate_relative_path(rel)?;
        let abs = tmp.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent).map_err(|e| FolderError::io(parent, e))?;
        }
        fs::write(&abs, content).map_err(|e| FolderError::io(&abs, e))?;
    }

    for (rel, source_rel) in &payload.asset_copies {
        validate_relative_path(rel)?;
        validate_relative_path(source_rel)?;
        let dst = tmp.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let src = source_project.join(source_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !src.is_file() {
            return Err(FolderError::Io {
                path: src.to_string_lossy().into_owned(),
                message: "referenced asset does not exist in source project".into(),
            });
        }
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| FolderError::io(parent, e))?;
        }
        // Hardlink first — O(1), no bytes copied. Falls back to a real
        // copy when the target filesystem doesn't support hardlinks
        // (cross-fs, exotic FS, network share).
        if fs::hard_link(&src, &dst).is_err() {
            fs::copy(&src, &dst).map_err(|e| FolderError::io(&dst, e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn tmp_dir(label: &str) -> PathBuf {
        let base = env::temp_dir().join(format!("lowcode-3d-export-{label}-{}", ts_suffix()));
        fs::create_dir_all(&base).unwrap();
        base
    }

    fn make_source_project(base: &Path) -> PathBuf {
        let project = base.join("source");
        fs::create_dir_all(project.join("assets")).unwrap();
        fs::write(project.join("project.json"), "{}").unwrap();
        fs::write(project.join("assets/cube.glb"), b"GLB_BYTES_v1").unwrap();
        project
    }

    fn make_payload(source: &Path, destination: &Path) -> ExportPayload {
        let mut text_files = HashMap::new();
        text_files.insert("package.json".into(), "{\"name\":\"test\"}\n".into());
        text_files.insert(
            "src/scene.js".into(),
            "export function buildScene() { return null; }\n".into(),
        );

        let mut asset_copies = HashMap::new();
        asset_copies.insert("assets/cube.glb".into(), "assets/cube.glb".into());

        ExportPayload {
            source_project_path: source.to_string_lossy().into_owned(),
            destination_path: destination.to_string_lossy().into_owned(),
            text_files,
            asset_copies,
        }
    }

    #[test]
    fn write_export_writes_text_and_copies_assets() {
        let base = tmp_dir("basic");
        let source = make_source_project(&base);
        let destination = base.join("out");
        let payload = make_payload(&source, &destination);

        let summary = write_export_files(payload).unwrap();
        assert_eq!(summary.text_file_count, 2);
        assert_eq!(summary.asset_file_count, 1);
        assert!(destination.join("package.json").is_file());
        assert!(destination.join("src/scene.js").is_file());
        assert!(destination.join("assets/cube.glb").is_file());
        assert_eq!(
            fs::read(destination.join("assets/cube.glb")).unwrap(),
            b"GLB_BYTES_v1"
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn write_export_overwrites_existing_directory() {
        let base = tmp_dir("overwrite");
        let source = make_source_project(&base);
        let destination = base.join("out");
        // Pre-existing content that should disappear post-swap.
        fs::create_dir_all(destination.join("nested")).unwrap();
        fs::write(destination.join("nested/old.txt"), "stale").unwrap();

        let payload = make_payload(&source, &destination);
        write_export_files(payload).unwrap();
        assert!(!destination.join("nested/old.txt").exists());
        assert!(destination.join("package.json").is_file());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn write_export_rejects_destination_inside_source() {
        let base = tmp_dir("inside-source");
        let source = make_source_project(&base);
        let destination = source.join("nested-export");
        let payload = make_payload(&source, &destination);
        let err = write_export_files(payload).unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn write_export_rejects_path_traversal_in_text_files() {
        let base = tmp_dir("traversal");
        let source = make_source_project(&base);
        let destination = base.join("out");
        let mut payload = make_payload(&source, &destination);
        payload
            .text_files
            .insert("../escape.txt".into(), "nope".into());
        let err = write_export_files(payload).unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        assert!(!destination.exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn write_export_rejects_missing_source_asset() {
        let base = tmp_dir("missing-asset");
        let source = make_source_project(&base);
        let destination = base.join("out");
        let mut payload = make_payload(&source, &destination);
        payload
            .asset_copies
            .insert("assets/missing.glb".into(), "assets/missing.glb".into());
        let err = write_export_files(payload).unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        assert!(!destination.exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn write_export_rejects_destination_that_is_a_file() {
        let base = tmp_dir("file-not-dir");
        let source = make_source_project(&base);
        let destination = base.join("oops.txt");
        fs::write(&destination, "regular file").unwrap();
        let payload = make_payload(&source, &destination);
        let err = write_export_files(payload).unwrap_err();
        assert!(matches!(err, FolderError::NotADirectory { .. }));
        let _ = fs::remove_dir_all(&base);
    }
}
