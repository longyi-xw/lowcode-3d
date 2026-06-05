import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { clearAiKey, hasAiKey, setAiKey, testConnection } from "@/services/ai/proxy";
import { useSettingsStore } from "@/services/settings/store";

/**
 * AI providers settings page. Anthropic card only this sub-stage: shows the
 * configured/not-configured state (from `has_ai_key` — the key is never read
 * back), a model field, a write-only key input (stored in the OS keychain via
 * the Rust proxy), and test / clear actions.
 */
export function AiProvidersSection() {
  const { t } = useTranslation("settings");
  const aiModel = useSettingsStore((s) => s.aiModel);
  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const [configured, setConfigured] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void hasAiKey()
      .then(setConfigured)
      .catch(() => setConfigured(false));
  };
  useEffect(refresh, []);

  const errMessage = (e: unknown): string =>
    (e as { data?: { message?: string } })?.data?.message ??
    (e as { code?: string })?.code ??
    "error";

  const onSave = async () => {
    if (!keyInput) return;
    setBusy(true);
    try {
      await setAiKey(keyInput);
      setKeyInput("");
      refresh();
    } catch (e) {
      toast.error(t("ai.test_fail", { message: errMessage(e) }));
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await clearAiKey();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      await testConnection();
      toast.success(t("ai.test_ok"));
    } catch (e) {
      toast.error(t("ai.test_fail", { message: errMessage(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">{t("ai.byok_note")}</p>

      <div className="rounded border border-border p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-medium">{t("ai.provider.anthropic")}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px]",
              configured
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {configured ? t("ai.configured") : t("ai.not_configured")}
          </span>
        </div>

        <label className="mb-2 flex items-center gap-2">
          <span className="w-16 text-muted-foreground">{t("ai.model")}</span>
          <input
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="flex-1 rounded border border-border bg-background/50 px-2 py-1 font-mono text-xs outline-none focus:border-primary"
          />
        </label>

        <label className="mb-2 flex items-center gap-2">
          <span className="w-16 text-muted-foreground">{t("ai.api_key")}</span>
          <input
            type="password"
            aria-label={t("ai.api_key")}
            value={keyInput}
            placeholder={configured ? "••••••••" : t("ai.key_placeholder")}
            onChange={(e) => setKeyInput(e.target.value)}
            className="flex-1 rounded border border-border bg-background/50 px-2 py-1 font-mono text-xs outline-none focus:border-primary"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !keyInput}
            onClick={() => void onSave()}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {t("ai.save")}
          </button>
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void onTest()}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {t("ai.test")}
          </button>
          <button
            type="button"
            disabled={busy || !configured}
            onClick={() => void onClear()}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {t("ai.clear")}
          </button>
        </div>
      </div>
    </div>
  );
}
