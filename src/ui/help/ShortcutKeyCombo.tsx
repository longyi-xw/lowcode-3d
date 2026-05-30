import { platformizeKeys } from "./shortcuts-registry";

interface Props {
  keys: string[];
}

/**
 * Renders a key combo like ⌘+N as a stack of <kbd> tags joined by "+".
 */
export function ShortcutKeyCombo({ keys }: Props) {
  const rendered = platformizeKeys(keys);
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-[11px]">
      {rendered.map((k, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="mx-0.5 text-zinc-500">+</span>}
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-200">
            {k}
          </kbd>
        </span>
      ))}
    </span>
  );
}
