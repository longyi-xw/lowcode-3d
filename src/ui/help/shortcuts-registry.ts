export interface ShortcutItem {
  /** Key combo to render, e.g. ["⌘", "N"] or ["?"]. ⌘ swapped to "Ctrl" on Win/Linux at render time. */
  keys: string[];
  /** i18n key under "shortcuts.*" namespace. */
  i18nKey: string;
}

export interface ShortcutSection {
  /** i18n key under "shortcuts.section.*". */
  titleI18nKey: string;
  items: ShortcutItem[];
}

export const KEYBOARD_SHORTCUTS: ShortcutSection[] = [
  {
    titleI18nKey: "shortcuts.section.project",
    items: [
      { keys: ["⌘", "N"], i18nKey: "shortcuts.new_project" },
      { keys: ["⌘", "O"], i18nKey: "shortcuts.open_project" },
      { keys: ["⌘", "S"], i18nKey: "shortcuts.save" },
      { keys: ["⇧", "⌘", "S"], i18nKey: "shortcuts.save_as" },
      { keys: ["⌘", "W"], i18nKey: "shortcuts.close_project" },
    ],
  },
  {
    titleI18nKey: "shortcuts.section.edit",
    items: [
      { keys: ["⌘", "Z"], i18nKey: "shortcuts.undo" },
      { keys: ["⇧", "⌘", "Z"], i18nKey: "shortcuts.redo" },
      { keys: ["⌘", "D"], i18nKey: "shortcuts.duplicate" },
      { keys: ["Del"], i18nKey: "shortcuts.delete" },
    ],
  },
  {
    titleI18nKey: "shortcuts.section.transform",
    items: [
      { keys: ["G"], i18nKey: "shortcuts.move_mode" },
      { keys: ["R"], i18nKey: "shortcuts.rotate_mode" },
      { keys: ["S"], i18nKey: "shortcuts.scale_mode" },
      { keys: ["⌘", "Drag"], i18nKey: "shortcuts.snap_grid" },
    ],
  },
  {
    titleI18nKey: "shortcuts.section.selection_view",
    items: [
      { keys: ["F"], i18nKey: "shortcuts.focus" },
      { keys: ["Esc"], i18nKey: "shortcuts.clear_selection" },
      { keys: ["⌘", "J"], i18nKey: "shortcuts.toggle_library" },
    ],
  },
  {
    titleI18nKey: "shortcuts.section.play",
    items: [{ keys: ["Space"], i18nKey: "shortcuts.play_toggle" }],
  },
  {
    titleI18nKey: "shortcuts.section.help",
    items: [
      { keys: ["?"], i18nKey: "shortcuts.help_open" },
      { keys: ["⌘", "/"], i18nKey: "shortcuts.help_open" },
    ],
  },
];

/**
 * On non-mac platforms, swap ⌘ → Ctrl for rendering. Always wins safely
 * (a missing platform string is treated as mac which renders ⌘ —
 * harmless on web preview).
 */
export function platformizeKeys(keys: string[]): string[] {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  if (isMac) return keys;
  return keys.map((k) => (k === "⌘" ? "Ctrl" : k));
}
