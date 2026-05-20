import "@testing-library/jest-dom/vitest";

// Boot i18next so component tests that depend on `t()` see real strings
// instead of raw keys. Production already wires this from src/main.tsx; in
// the test environment we trigger the same module side-effect once per
// worker by importing it from setup.
import "@/i18n";
