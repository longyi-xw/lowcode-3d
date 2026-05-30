import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/services/ui/store";

import { KEYBOARD_SHORTCUTS } from "./shortcuts-registry";
import { ShortcutKeyCombo } from "./ShortcutKeyCombo";

export function ShortcutsHelpDialog() {
  const { t } = useTranslation("editor");
  const helpOpen = useUIStore((s) => s.helpOpen);
  const setHelpOpen = useUIStore((s) => s.setHelpOpen);
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("help.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {KEYBOARD_SHORTCUTS.map((section) => (
            <section key={section.titleI18nKey}>
              <h3 className="text-xs font-semibold uppercase text-zinc-400">
                {t(section.titleI18nKey, { defaultValue: section.titleI18nKey })}
              </h3>
              <ul className="mt-1.5 space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>{t(item.i18nKey, { defaultValue: item.i18nKey })}</span>
                    <ShortcutKeyCombo keys={item.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
