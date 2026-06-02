fn main() {
    lowcode_3d_lib::export_bindings().expect("failed to export TypeScript bindings");
    println!("Generated src/bindings/tauri.ts");
}
