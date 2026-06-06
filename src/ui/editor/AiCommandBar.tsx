import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { runSkill } from "@/services/skills/run";
import { SkillError } from "@/services/skills/types";
import { useUIStore } from "@/services/ui/store";

/**
 * Persistent natural-language command bar (top of the center column). Runs the
 * scene-edit skill: input → LLM (active provider) → structured ops → undoable
 * Commands. Errors are layered into toasts (SkillError vs proxy AiError).
 */
export function AiCommandBar() {
  const { t } = useTranslation("editor");
  const playState = useUIStore((s) => s.playState);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const disabled = playState === "play" || busy;

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const { count } = await runSkill("scene-edit", text);
      if (count === 0) toast(t("ai_command.no_changes"));
      else toast.success(t("ai_command.done", { count }));
      setInput("");
    } catch (e) {
      if (e instanceof SkillError) {
        toast.error(t("ai_command.didnt_understand"));
      } else {
        const message =
          (e as { data?: { message?: string } })?.data?.message ??
          (e as { code?: string })?.code ??
          "error";
        toast.error(t("ai_command.llm_error", { message }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-1.5">
      <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <input
        type="text"
        value={input}
        disabled={disabled}
        placeholder={t("ai_command.placeholder")}
        aria-label={t("ai_command.placeholder")}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled || !input.trim()}
        onClick={() => void submit()}
        className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground disabled:opacity-50"
      >
        {busy ? t("ai_command.thinking") : t("ai_command.send")}
      </button>
    </div>
  );
}
