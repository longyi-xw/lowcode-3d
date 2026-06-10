import { useTranslation } from "react-i18next";

import { isEngineEditingCapable } from "@/runtime/render-host";
import { useUIStore } from "@/services/ui/store";

export function PlayButton() {
  const { t } = useTranslation("editor");
  const playState = useUIStore((s) => s.playState);
  const setPlayState = useUIStore((s) => s.setPlayState);
  const viewportEngine = useUIStore((s) => s.viewportEngine);
  const isPlay = playState === "play";
  const editingCapable = isEngineEditingCapable(viewportEngine);

  return (
    <button
      type="button"
      disabled={!editingCapable}
      title={editingCapable ? undefined : t("play.engine_unavailable")}
      onClick={() => setPlayState(isPlay ? "edit" : "play")}
      className={`rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
        isPlay
          ? "bg-amber-600 text-white"
          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      }`}
    >
      {isPlay ? `⏸ ${t("play.pause")}` : `▶ ${t("play.play")}`}
    </button>
  );
}
