//! Asset import + read commands for the project's `assets/` subfolder.
//!
//! Assets are content-addressed: the SHA-256 of the file bytes becomes the
//! filename inside `assets/`. Re-importing identical bytes is a no-op (the
//! file already exists at the same path) and gives natural dedup so 50 copies
//! of the same model take one .glb on disk.
//!
//! Imports happen at edit-time, not save-time, so the project folder must
//! already exist. The frontend gates the Import menu item on `currentPath`
//! being set; an attempt to import into a not-yet-saved project surfaces a
//! `FolderError::Io` for the missing target dir.

use std::fs;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;

use crate::project_io::FolderError;

const ASSETS_DIR: &str = "assets";

#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub struct ImportedAsset {
    /// Lowercase hex SHA-256 of the file bytes.
    pub content_hash: String,
    /// Project-relative POSIX path the file was written to (e.g.
    /// `assets/<hash>.glb`).
    pub relative_path: String,
    /// Basename of the source file (before any rename / hash mapping). The TS
    /// side stores this in `AssetReference.source.original_filename` so the
    /// editor can show the human name even though the on-disk file is opaque.
    pub original_filename: String,
    /// File size in bytes — surfaced in the properties panel so a user
    /// importing a 200 MB .glb gets visual feedback. Serialized as f64
    /// (not u64) because specta forbids BigInt-style ints across the FFI
    /// boundary; f64 is exact through 2^53, well above any plausible glTF
    /// size.
    pub byte_length: f64,
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(64);
    for b in digest {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn ensure_project_dir(project_path: &Path) -> Result<(), FolderError> {
    if !project_path.exists() {
        return Err(FolderError::Io {
            path: project_path.to_string_lossy().into_owned(),
            message: "project path does not exist — save the project first".into(),
        });
    }
    if !project_path.is_dir() {
        return Err(FolderError::NotADirectory {
            path: project_path.to_string_lossy().into_owned(),
        });
    }
    Ok(())
}

fn basename(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn extension(path: &Path) -> Option<String> {
    path.extension().map(|e| e.to_string_lossy().to_lowercase())
}

#[tauri::command]
#[specta::specta]
pub fn import_glb_into_project(
    source_path: String,
    project_path: String,
) -> Result<ImportedAsset, FolderError> {
    let source = PathBuf::from(&source_path);
    let project = PathBuf::from(&project_path);

    if !source.is_file() {
        return Err(FolderError::Io {
            path: source_path.clone(),
            message: "source file does not exist".into(),
        });
    }
    let ext = extension(&source).ok_or_else(|| FolderError::Io {
        path: source_path.clone(),
        message: "source has no file extension".into(),
    })?;
    if ext != "glb" && ext != "gltf" {
        return Err(FolderError::Io {
            path: source_path.clone(),
            message: format!("unsupported extension .{ext} — expected .glb or .gltf"),
        });
    }

    ensure_project_dir(&project)?;

    let bytes = fs::read(&source).map_err(|e| FolderError::io(&source, e))?;
    let byte_length = bytes.len() as f64;
    let hash = sha256_hex(&bytes);
    let original_filename = basename(&source);

    let assets_dir = project.join(ASSETS_DIR);
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| FolderError::io(&assets_dir, e))?;
    }
    let relative_path = format!("{ASSETS_DIR}/{hash}.{ext}");
    let target = assets_dir.join(format!("{hash}.{ext}"));

    if !target.exists() {
        // Same hash + same project = same bytes — no need to rewrite if it
        // happens to already exist (e.g. re-imported after a crash).
        write_atomic(&target, &bytes)?;
    }

    Ok(ImportedAsset {
        content_hash: hash,
        relative_path,
        original_filename,
        byte_length,
    })
}

fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), FolderError> {
    let parent = target.parent().ok_or_else(|| FolderError::Io {
        path: target.to_string_lossy().into_owned(),
        message: "target has no parent dir".into(),
    })?;
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "asset".into());
    let tmp = parent.join(format!(".{name}.tmp"));
    fs::write(&tmp, bytes).map_err(|e| FolderError::io(&tmp, e))?;
    if let Err(e) = fs::rename(&tmp, target) {
        let _ = fs::remove_file(&tmp);
        return Err(FolderError::io(target, e));
    }
    Ok(())
}

/// Returns the asset bytes as standard (RFC 4648) base64. Encoded rather than
/// the raw `Vec<u8>` because specta-generated bindings serialize byte vecs as
/// `number[]` — fine for tiny payloads, catastrophic for a 5 MB .glb (5M
/// JSON numbers, ~half a second of parse time). Base64 is ~33 % overhead +
/// O(N) encode/decode, but the bytes stay in compact-string form across the
/// IPC boundary.
#[tauri::command]
#[specta::specta]
pub fn read_project_asset(
    project_path: String,
    relative_path: String,
) -> Result<String, FolderError> {
    let project = PathBuf::from(&project_path);
    ensure_project_dir(&project)?;

    if relative_path.starts_with('/') || relative_path.split('/').any(|seg| seg == "..") {
        return Err(FolderError::Io {
            path: relative_path,
            message: "relative paths only — no leading / or .. segments".into(),
        });
    }
    let abs = project.join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
    let bytes = fs::read(&abs).map_err(|e| FolderError::io(&abs, e))?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp_dir(label: &str) -> PathBuf {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| format!("{}-{}", d.as_secs(), d.subsec_nanos()))
            .unwrap_or_default();
        let base = env::temp_dir().join(format!("lowcode-3d-assets-{label}-{ts}"));
        fs::create_dir_all(&base).unwrap();
        base
    }

    fn write_fixture(dir: &Path, name: &str, bytes: &[u8]) -> PathBuf {
        let p = dir.join(name);
        fs::write(&p, bytes).unwrap();
        p
    }

    #[test]
    fn import_writes_to_content_addressed_path() {
        let base = tmp_dir("import-basic");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let glb = write_fixture(&base, "cube.glb", b"GLB_BYTES_v1");

        let imported = import_glb_into_project(
            glb.to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap();

        assert_eq!(imported.original_filename, "cube.glb");
        assert_eq!(imported.byte_length as u64, 12);
        assert!(imported.relative_path.starts_with("assets/"));
        assert!(imported.relative_path.ends_with(".glb"));
        let on_disk = project.join(&imported.relative_path);
        assert!(on_disk.is_file());
        assert_eq!(fs::read(&on_disk).unwrap(), b"GLB_BYTES_v1");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn import_dedups_identical_bytes() {
        let base = tmp_dir("import-dedup");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let glb1 = write_fixture(&base, "first.glb", b"SHARED_BYTES");
        let glb2 = write_fixture(&base, "second.glb", b"SHARED_BYTES");

        let a = import_glb_into_project(
            glb1.to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap();
        let b = import_glb_into_project(
            glb2.to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap();

        assert_eq!(a.content_hash, b.content_hash);
        assert_eq!(a.relative_path, b.relative_path);
        // Original filename is preserved per import even though storage dedups.
        assert_eq!(a.original_filename, "first.glb");
        assert_eq!(b.original_filename, "second.glb");
        let entries: Vec<_> = fs::read_dir(project.join("assets")).unwrap().collect();
        assert_eq!(entries.len(), 1);

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn import_rejects_missing_source() {
        let base = tmp_dir("import-missing");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let err = import_glb_into_project(
            base.join("nope.glb").to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn import_rejects_bad_extension() {
        let base = tmp_dir("import-ext");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let bad = write_fixture(&base, "shader.frag", b"void main(){}");
        let err = import_glb_into_project(
            bad.to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn import_rejects_missing_project_dir() {
        let base = tmp_dir("import-unsaved");
        let glb = write_fixture(&base, "cube.glb", b"any");
        let err = import_glb_into_project(
            glb.to_string_lossy().into_owned(),
            base.join("does-not-exist").to_string_lossy().into_owned(),
        )
        .unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn read_project_asset_round_trips() {
        let base = tmp_dir("read-roundtrip");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let glb = write_fixture(&base, "cube.glb", b"DATA_42");

        let imported = import_glb_into_project(
            glb.to_string_lossy().into_owned(),
            project.to_string_lossy().into_owned(),
        )
        .unwrap();
        let read_back = read_project_asset(
            project.to_string_lossy().into_owned(),
            imported.relative_path,
        )
        .unwrap();
        let decoded = general_purpose::STANDARD.decode(read_back).unwrap();
        assert_eq!(decoded, b"DATA_42");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn read_project_asset_rejects_path_traversal() {
        let base = tmp_dir("read-traversal");
        let project = base.join("proj");
        fs::create_dir_all(&project).unwrap();
        let err = read_project_asset(
            project.to_string_lossy().into_owned(),
            "../escape".into(),
        )
        .unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }
}
