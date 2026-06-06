import { commands, type AiCompleteResponse, type AiProvider } from "@/bindings/tauri";
import { useSettingsStore } from "@/services/settings/store";

/**
 * Call the LLM via the Rust proxy, using the *active* provider + its model
 * (settings). `jsonSchema` (any JSON-serializable value) is stringified for the
 * IPC boundary; pass it to force structured output. Throws the `AiError`
 * (`{ code, data? }`) on failure — callers map to a toast.
 */
export async function aiComplete(opts: {
  system: string;
  user: string;
  jsonSchema?: unknown;
}): Promise<AiCompleteResponse> {
  const { aiProvider, aiModels } = useSettingsStore.getState();
  const res = await commands.aiComplete({
    provider: aiProvider,
    model: aiModels[aiProvider],
    system: opts.system,
    user: opts.user,
    json_schema: opts.jsonSchema != null ? JSON.stringify(opts.jsonSchema) : null,
  });
  if (res.status === "error") throw res.error;
  return res.data;
}

export async function setAiKey(provider: AiProvider, key: string): Promise<void> {
  const res = await commands.setAiKey(provider, key);
  if (res.status === "error") throw res.error;
}

export async function hasAiKey(provider: AiProvider): Promise<boolean> {
  const res = await commands.hasAiKey(provider);
  if (res.status === "error") throw res.error;
  return res.data;
}

export async function clearAiKey(provider: AiProvider): Promise<void> {
  const res = await commands.clearAiKey(provider);
  if (res.status === "error") throw res.error;
}

/** Resolves on success; throws AiError on failure (used by the 测试连接 button).
 *  Tests a specific provider with its configured model. */
export async function testConnection(provider: AiProvider): Promise<void> {
  const model = useSettingsStore.getState().aiModels[provider];
  const res = await commands.testAiProvider(provider, model);
  if (res.status === "error") throw res.error;
}
