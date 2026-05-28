import { useTranslation } from "react-i18next";

import { useUIStore } from "@/services/ui/store";

export function PlayButton() {
  const { t } = useTranslation("editor");
  const playState = useUIStore((s) => s.playState);
  const setPlayState = useUIStore((s) => s.setPlayState);
  const isPlay = playState === "play";

  return (
    <button
      type="button"
      onClick={() => setPlayState(isPlay ? "edit" : "play")}
      className={`rounded px-3 py-1 text-sm ${
        isPlay
          ? "bg-amber-600 text-white"
          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      }`}
    >
      {isPlay ? `⏸ ${t("play.pause")}` : `▶ ${t("play.play")}`}
    </button>
  );
}
