import { commands, type AiCompleteResponse } from "@/bindings/tauri";
import { useSettingsStore } from "@/services/settings/store";

function provider() {
  return useSettingsStore.getState().aiProvider;
}

/**
 * Call the LLM via the Rust proxy. `jsonSchema` (any JSON-serializable value)
 * is stringified for the IPC boundary; pass it to force structured output.
 * Throws the `AiError` (`{ code, data? }`) on failure — callers map to a toast.
 */
export async function aiComplete(opts: {
  system: string;
  user: string;
  jsonSchema?: unknown;
}): Promise<AiCompleteResponse> {
  const { aiProvider, aiModel } = useSettingsStore.getState();
  const res = await commands.aiComplete({
    provider: aiProvider,
    model: aiModel,
    system: opts.system,
    user: opts.user,
    json_schema: opts.jsonSchema != null ? JSON.stringify(opts.jsonSchema) : null,
  });
  if (res.status === "error") throw res.error;
  return res.data;
}

export async function setAiKey(key: string): Promise<void> {
  const res = await commands.setAiKey(provider(), key);
  if (res.status === "error") throw res.error;
}

export async function hasAiKey(): Promise<boolean> {
  const res = await commands.hasAiKey(provider());
  if (res.status === "error") throw res.error;
  return res.data;
}

export async function clearAiKey(): Promise<void> {
  const res = await commands.clearAiKey(provider());
  if (res.status === "error") throw res.error;
}

/** Resolves on success; throws AiError on failure (used by the 测试连接 button). */
export async function testConnection(): Promise<void> {
  const { aiProvider, aiModel } = useSettingsStore.getState();
  const res = await commands.testAiProvider(aiProvider, aiModel);
  if (res.status === "error") throw res.error;
}
