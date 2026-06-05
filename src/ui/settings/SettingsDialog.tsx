import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/services/ui/store";

import { AiProvidersSection } from "./AiProvidersSection";

type SettingsPage = "ai_providers";

const NAV: { id: SettingsPage; labelKey: string }[] = [
  { id: "ai_providers", labelKey: "nav.ai_providers" },
];

/**
 * Settings dialog hosted on the reserved `useUIStore.settingsOpen` flag (opened
 * by the gear buttons). Nav is data-driven; only the AI providers page exists
 * this sub-stage — the rest of the img_5 prototype (General/Appearance/…/Skill
 * routing) fills in later.
 */
export function SettingsDialog() {
  const { t } = useTranslation("settings");
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const [page, setPage] = useState<SettingsPage>("ai_providers");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[180px_1fr] gap-4">
          <nav className="flex flex-col gap-1 border-r border-border pr-2">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={cn(
                  "rounded px-2 py-1 text-left text-sm",
                  page === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t(item.labelKey, { defaultValue: item.labelKey })}
              </button>
            ))}
          </nav>
          <div className="min-h-[320px]">
            {page === "ai_providers" && <AiProvidersSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
