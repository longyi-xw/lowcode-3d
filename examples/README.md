# examples/

Reference SceneProject fixtures used by docs and tests.

- [`empty-project/`](./empty-project/) — minimum SceneProject that satisfies
  `SceneProjectSchema`. Use this as a starting template.
- [`single-cube/`](./single-cube/) — one mesh + one directional light + one
  perspective camera. Exercises every NodeData variant we actively render and
  shows how a builtin asset reference looks.

Format note: these examples store the entire SceneProject in a single
`project.json` (the in-memory shape). The on-disk persistence layout described
in `design/framework/architecture.md` §3.5 splits nodes into individual files
under `scene/nodes/{id}.json` — that split is the parser's responsibility and
lands in Phase 2 along with Rust-side file I/O.
