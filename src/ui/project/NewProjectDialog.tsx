import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProjectFromTemplate } from "@/services/project/actions";
import { PROJECT_TEMPLATES } from "@/services/scene/templates";
import { useUIStore } from "@/services/ui/store";

export function NewProjectDialog() {
  const { t } = useTranslation("project");
  const open = useUIStore((s) => s.newProjectOpen);
  const setOpen = useUIStore((s) => s.setNewProjectOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("new_dialog.title")}</DialogTitle>
          <DialogDescription>{t("new_dialog.description")}</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {PROJECT_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <li key={tpl.id}>
                <button
                  type="button"
                  onClick={() => void createProjectFromTemplate(tpl.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition hover:bg-muted"
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {t(tpl.nameKey)}
                      {tpl.recommended && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                          {t("recommended_badge")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t(tpl.descriptionKey)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
