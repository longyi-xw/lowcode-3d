//! File-I/O commands for the architecture §3.5 project folder format.
//!
//! TS-side `serializeProject` produces a `Map<path, string>`; this module
//! commits that map to disk via a side-by-side temp directory + atomic rename
//! so a partial failure never corrupts an existing project.
//!
//! Layout written:
//! ```text
//! {target}/
//! ├── project.json
//! └── scene/
//!     ├── hierarchy.json
//!     └── nodes/{id}.json
//! ```
//!
//! Save algorithm:
//!   1. Create `.{stem}.lowcode-tmp-{ts}` as a sibling of the target.
//!   2. Write every entry of `files` under the tmp dir.
//!   3. If target exists, rename it to `.{stem}.lowcode-bak-{ts}`.
//!   4. Rename tmp → target. POSIX guarantees this is atomic when both paths
//!      are on the same filesystem; the sibling approach ensures that.
//!   5. Remove the bak directory.
//!   6. Any failure between step 1 and 4: clean up tmp + restore bak if step 3
//!      already happened.
//!
//! Open algorithm: walk `{project}/project.json` + `{project}/scene/**/*.json`
//! into a `HashMap<String, String>` keyed by forward-slash relative paths.
//! Other paths (assets/, .lowcode/, .git/) are skipped at this layer.

use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

pub type ProjectFiles = HashMap<String, String>;

const PROJECT_FILE: &str = "project.json";
const SCENE_DIR: &str = "scene";
const ASSETS_DIR: &str = "assets";

#[derive(Debug, Serialize, Deserialize, Type)]
#[serde(tag = "code", content = "data", rename_all = "snake_case")]
pub enum FolderError {
    /// std::io::Error wrapped with the path that triggered it.
    Io { path: String, message: String },
    /// Target path exists but isn't a directory.
    NotADirectory { path: String },
    /// Save target is a non-empty directory that doesn't look like a saved
    /// lowcode-3d project. Front-end should ask "overwrite?" and call again
    /// with `overwrite: true`.
    AlreadyExistsNotEmpty { path: String },
    /// Reserved for forwarding TS-side `PersistenceError` through the same
    /// error union so the UI has a single error shape to handle.
    Persistence { detail: String },
}

impl FolderError {
    pub(crate) fn io(path: impl AsRef<Path>, err: io::Error) -> Self {
        FolderError::Io {
            path: path.as_ref().to_string_lossy().into_owned(),
            message: err.to_string(),
        }
    }
}

fn ts_suffix() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| format!("{}-{}", d.as_secs(), d.subsec_nanos()))
        .unwrap_or_else(|_| "0".into())
}

fn is_project_dir(path: &Path) -> bool {
    path.join(PROJECT_FILE).is_file()
}

fn dir_is_empty(path: &Path) -> io::Result<bool> {
    let mut iter = fs::read_dir(path)?;
    Ok(iter.next().is_none())
}

#[tauri::command]
#[specta::specta]
pub fn save_project_folder(
    path: String,
    files: ProjectFiles,
    overwrite: bool,
) -> Result<(), FolderError> {
    let target = PathBuf::from(&path);

    if target.exists() {
        if !target.is_dir() {
            return Err(FolderError::NotADirectory { path });
        }
        if !is_project_dir(&target) && !overwrite {
            let empty = dir_is_empty(&target).map_err(|e| FolderError::io(&target, e))?;
            if !empty {
                return Err(FolderError::AlreadyExistsNotEmpty { path });
            }
        }
    }

    let parent = target.parent().ok_or_else(|| FolderError::Io {
        path: path.clone(),
        message: "target path has no parent directory".into(),
    })?;
    let stem = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".into());
    let ts = ts_suffix();
    let tmp = parent.join(format!(".{stem}.lowcode-tmp-{ts}"));
    let bak = parent.join(format!(".{stem}.lowcode-bak-{ts}"));

    fs::create_dir_all(&tmp).map_err(|e| FolderError::io(&tmp, e))?;

    if let Err(e) = write_all_into(&tmp, &files) {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }

    // Preserve the assets/ folder across the atomic swap. The serialized
    // files map only contains the JSON manifest — the actual .glb / texture
    // bytes were written at import time directly into target/assets/. Without
    // this step the swap would orphan them. We hardlink each file (O(1), no
    // bytes copied) so save stays cheap even with many large assets; failing
    // a hardlink (e.g. cross-fs) falls back to copy.
    if let Err(e) = preserve_subdir(&target, &tmp, ASSETS_DIR) {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }

    let target_existed = target.exists();
    if target_existed {
        if let Err(e) = fs::rename(&target, &bak) {
            let _ = fs::remove_dir_all(&tmp);
            return Err(FolderError::io(&target, e));
        }
    }
    if let Err(e) = fs::rename(&tmp, &target) {
        if target_existed {
            let _ = fs::rename(&bak, &target);
        }
        let _ = fs::remove_dir_all(&tmp);
        return Err(FolderError::io(&target, e));
    }
    if target_existed {
        let _ = fs::remove_dir_all(&bak);
    }

    Ok(())
}

/// Mirror `target/{subdir}` into `tmp/{subdir}` so a subsequent atomic swap
/// doesn't orphan it. Hardlinks per-file; falls back to byte-copy if the
/// filesystem rejects hardlinks (e.g. cross-fs, exotic FS).
fn preserve_subdir(target: &Path, tmp: &Path, subdir: &str) -> Result<(), FolderError> {
    let from = target.join(subdir);
    if !from.is_dir() {
        return Ok(());
    }
    let to = tmp.join(subdir);
    mirror_dir(&from, &to)
}

fn mirror_dir(from: &Path, to: &Path) -> Result<(), FolderError> {
    fs::create_dir_all(to).map_err(|e| FolderError::io(to, e))?;
    for entry in fs::read_dir(from).map_err(|e| FolderError::io(from, e))? {
        let entry = entry.map_err(|e| FolderError::io(from, e))?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        let ft = entry.file_type().map_err(|e| FolderError::io(&src, e))?;
        if ft.is_dir() {
            mirror_dir(&src, &dst)?;
        } else if ft.is_file() {
            if fs::hard_link(&src, &dst).is_err() {
                fs::copy(&src, &dst).map_err(|e| FolderError::io(&dst, e))?;
            }
        }
    }
    Ok(())
}

fn write_all_into(root: &Path, files: &ProjectFiles) -> Result<(), FolderError> {
    for (rel, content) in files {
        if rel.starts_with('/') || rel.split('/').any(|seg| seg == "..") {
            return Err(FolderError::Io {
                path: rel.clone(),
                message: "relative paths only — no leading / or .. segments".into(),
            });
        }
        let abs = root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = abs.parent() {
            fs::create_dir_all(parent).map_err(|e| FolderError::io(parent, e))?;
        }
        fs::write(&abs, content).map_err(|e| FolderError::io(&abs, e))?;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn open_project_folder(path: String) -> Result<ProjectFiles, FolderError> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(FolderError::Io {
            path,
            message: "path does not exist".into(),
        });
    }
    if !target.is_dir() {
        return Err(FolderError::NotADirectory { path });
    }

    let mut files = HashMap::new();

    let project_file = target.join(PROJECT_FILE);
    if !project_file.is_file() {
        return Err(FolderError::Io {
            path: project_file.to_string_lossy().into_owned(),
            message: format!("not a lowcode-3d project (missing {PROJECT_FILE})"),
        });
    }
    let content =
        fs::read_to_string(&project_file).map_err(|e| FolderError::io(&project_file, e))?;
    files.insert(PROJECT_FILE.into(), content);

    let scene_dir = target.join(SCENE_DIR);
    if scene_dir.is_dir() {
        collect_json(&target, &scene_dir, &mut files)?;
    }

    Ok(files)
}

fn collect_json(root: &Path, dir: &Path, out: &mut ProjectFiles) -> Result<(), FolderError> {
    for entry in fs::read_dir(dir).map_err(|e| FolderError::io(dir, e))? {
        let entry = entry.map_err(|e| FolderError::io(dir, e))?;
        let path = entry.path();
        let ft = entry.file_type().map_err(|e| FolderError::io(&path, e))?;
        if ft.is_dir() {
            collect_json(root, &path, out)?;
        } else if ft.is_file() && path.extension().is_some_and(|ext| ext == "json") {
            let rel = path
                .strip_prefix(root)
                .map_err(|_| FolderError::Io {
                    path: path.to_string_lossy().into_owned(),
                    message: "file is outside project root".into(),
                })?
                .to_string_lossy()
                .replace(std::path::MAIN_SEPARATOR, "/");
            let content = fs::read_to_string(&path).map_err(|e| FolderError::io(&path, e))?;
            out.insert(rel, content);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn tmp_dir(label: &str) -> PathBuf {
        let base = env::temp_dir().join(format!("lowcode-3d-test-{label}-{}", ts_suffix()));
        fs::create_dir_all(&base).unwrap();
        base
    }

    fn sample_files() -> ProjectFiles {
        let mut m = HashMap::new();
        m.insert("project.json".into(), "{\"hello\":\"world\"}".into());
        m.insert(
            "scene/hierarchy.json".into(),
            "{\"root_node_ids\":[]}".into(),
        );
        m.insert(
            "scene/nodes/cube-1.json".into(),
            "{\"id\":\"cube-1\"}".into(),
        );
        m
    }

    #[test]
    fn save_then_open_round_trips() {
        let base = tmp_dir("roundtrip");
        let target = base.join("proj");
        save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap();

        assert!(target.join("project.json").exists());
        assert!(target.join("scene/nodes/cube-1.json").exists());

        let opened = open_project_folder(target.to_string_lossy().into_owned()).unwrap();
        assert_eq!(opened.len(), 3);
        assert!(opened.contains_key("project.json"));
        assert!(opened.contains_key("scene/hierarchy.json"));
        assert!(opened.contains_key("scene/nodes/cube-1.json"));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn save_to_existing_lowcode_project_overwrites_silently() {
        let base = tmp_dir("overwrite-existing");
        let target = base.join("proj");
        save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap();

        let mut second = sample_files();
        second.insert(
            "scene/nodes/cube-2.json".into(),
            "{\"id\":\"cube-2\"}".into(),
        );
        save_project_folder(target.to_string_lossy().into_owned(), second, false).unwrap();

        let opened = open_project_folder(target.to_string_lossy().into_owned()).unwrap();
        assert!(opened.contains_key("scene/nodes/cube-2.json"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn save_refuses_nonempty_non_project_dir_without_overwrite() {
        let base = tmp_dir("nonempty");
        let target = base.join("notes");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("README.md"), "hello").unwrap();

        let err = save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap_err();
        assert!(matches!(err, FolderError::AlreadyExistsNotEmpty { .. }));

        save_project_folder(target.to_string_lossy().into_owned(), sample_files(), true)
            .unwrap();
        assert!(target.join("project.json").exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn save_refuses_when_target_path_is_a_file() {
        let base = tmp_dir("file-not-dir");
        let target = base.join("oops.txt");
        fs::write(&target, "regular file").unwrap();
        let err = save_project_folder(target.to_string_lossy().into_owned(), sample_files(), true)
            .unwrap_err();
        assert!(matches!(err, FolderError::NotADirectory { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn open_missing_project_json_errors() {
        let base = tmp_dir("missing-project");
        let target = base.join("empty");
        fs::create_dir_all(&target).unwrap();
        let err = open_project_folder(target.to_string_lossy().into_owned()).unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn open_skips_non_json_files_in_scene() {
        let base = tmp_dir("skip-binary");
        let target = base.join("proj");
        save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap();
        fs::write(target.join("scene/nodes/blob.bin"), [0u8, 1, 2, 3]).unwrap();
        let opened = open_project_folder(target.to_string_lossy().into_owned()).unwrap();
        assert!(!opened.contains_key("scene/nodes/blob.bin"));
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn save_preserves_existing_assets_dir() {
        let base = tmp_dir("preserve-assets");
        let target = base.join("proj");
        // First save lays down project.json + scene/.
        save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap();
        // Simulate an asset that landed in assets/ at import time, between
        // the first save and the second.
        fs::create_dir_all(target.join("assets")).unwrap();
        fs::write(target.join("assets/abc123.glb"), b"GLB_BYTES").unwrap();

        // Second save: serialized files are still just project.json + scene/.
        save_project_folder(
            target.to_string_lossy().into_owned(),
            sample_files(),
            false,
        )
        .unwrap();
        assert!(target.join("assets/abc123.glb").is_file());
        assert_eq!(
            fs::read(target.join("assets/abc123.glb")).unwrap(),
            b"GLB_BYTES"
        );
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn save_rejects_files_with_traversal_path() {
        let base = tmp_dir("traversal");
        let target = base.join("proj");
        let mut bad = sample_files();
        bad.insert("../escape.json".into(), "nope".into());
        let err = save_project_folder(target.to_string_lossy().into_owned(), bad, false)
            .unwrap_err();
        assert!(matches!(err, FolderError::Io { .. }));
        // target shouldn't have been created since write_all_into errored before swap
        assert!(!target.exists());
        let _ = fs::remove_dir_all(&base);
    }
}
