import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AiProvider } from "@/bindings/tauri";
import { cn } from "@/lib/utils";
import { clearAiKey, hasAiKey, setAiKey, testConnection } from "@/services/ai/proxy";
import { useSettingsStore } from "@/services/settings/store";

const PROVIDERS: AiProvider[] = ["anthropic", "deepseek"];

/**
 * AI providers settings page — one card per provider (img_5 prototype). Each
 * card owns its key (OS keychain), model, and connection test; a radio picks
 * the active provider that `ai_complete` uses. Keys are write-only — the UI
 * only shows configured/not-configured (from `has_ai_key`), never the key.
 */
export function AiProvidersSection() {
  const { t } = useTranslation("settings");
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const setAiProvider = useSettingsStore((s) => s.setAiProvider);

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">{t("ai.byok_note")}</p>
      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            active={aiProvider === p}
            onActivate={() => setAiProvider(p)}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  active,
  onActivate,
}: {
  provider: AiProvider;
  active: boolean;
  onActivate: () => void;
}) {
  const { t } = useTranslation("settings");
  const model = useSettingsStore((s) => s.aiModels[provider]);
  const setAiModel = useSettingsStore((s) => s.setAiModel);
  const [configured, setConfigured] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [busy, setBusy] = useState(false);

  const name = t(`ai.provider.${provider}`, { defaultValue: provider });

  const refresh = () => {
    void hasAiKey(provider)
      .then(setConfigured)
      .catch(() => setConfigured(false));
  };
  useEffect(refresh, [provider]);

  const errMessage = (e: unknown): string =>
    (e as { data?: { message?: string } })?.data?.message ??
    (e as { code?: string })?.code ??
    "error";

  const onSave = async () => {
    if (!keyInput) return;
    setBusy(true);
    try {
      await setAiKey(provider, keyInput);
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
      await clearAiKey(provider);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      await testConnection(provider);
      toast.success(t("ai.test_ok"));
    } catch (e) {
      toast.error(t("ai.test_fail", { message: errMessage(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-provider={provider}
      className={cn("rounded border p-3", active ? "border-primary" : "border-border")}
    >
      <div className="mb-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="ai-active-provider"
            checked={active}
            onChange={onActivate}
            aria-label={t("ai.use_provider", { name })}
          />
          <span className="font-medium">{name}</span>
        </label>
        {active && (
          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
            {t("ai.active")}
          </span>
        )}
        <span
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[10px]",
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
          value={model}
          onChange={(e) => setAiModel(provider, e.target.value)}
          className="flex-1 rounded border border-border bg-background/50 px-2 py-1 font-mono text-xs outline-none focus:border-primary"
        />
      </label>

      <label className="mb-2 flex items-center gap-2">
        <span className="w-16 text-muted-foreground">{t("ai.api_key")}</span>
        <input
          type="password"
          aria-label={`${name} ${t("ai.api_key")}`}
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
  );
}
