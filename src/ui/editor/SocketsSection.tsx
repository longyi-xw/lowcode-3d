import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SetNodeSocketsCommand } from "@/core/command/commands/set-node-sockets";
import { generateUUID } from "@/core/id/uuid";
import type { SceneNode, Socket } from "@/core/scene/types";
import { executeCommand } from "@/services/command-history";

export function SocketsSection({ node }: { node: SceneNode }) {
  const { t } = useTranslation("editor");
  const sockets = node.sockets ?? [];

  const commit = (next: Socket[]) =>
    executeCommand(
      new SetNodeSocketsCommand({
        node_id: node.id,
        sockets: next,
        prev_sockets: sockets,
      }),
    );

  const add = () =>
    commit([
      ...sockets,
      { id: generateUUID(), name: "socket", position: [0, 0, 0], tag: "" },
    ]);
  const remove = (id: string) => commit(sockets.filter((s) => s.id !== id));
  const patch = (id: string, p: Partial<Socket>) =>
    commit(sockets.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-3 font-mono text-[11px]">
      <div className="flex items-center justify-between">
        <p className="uppercase tracking-wider text-muted-foreground">
          {t("sockets.section")}
        </p>
        <button
          type="button"
          onClick={add}
          title={t("sockets.add")}
          className="flex items-center rounded px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {sockets.length === 0 ? (
        <p className="text-muted-foreground">{t("sockets.empty")}</p>
      ) : (
        sockets.map((s) => (
          <SocketRow
            key={s.id}
            socket={s}
            tagPlaceholder={t("sockets.tag_placeholder")}
            onPatch={(p) => patch(s.id, p)}
            onRemove={() => remove(s.id)}
          />
        ))
      )}
    </div>
  );
}

function SocketRow({
  socket,
  tagPlaceholder,
  onPatch,
  onRemove,
}: {
  socket: Socket;
  tagPlaceholder: string;
  onPatch: (p: Partial<Socket>) => void;
  onRemove: () => void;
}) {
  const inputCls =
    "rounded border border-border bg-background/50 px-1.5 py-0.5 outline-none focus:border-primary";
  return (
    <div className="space-y-1 rounded border border-border p-1.5">
      <div className="flex items-center gap-1">
        <input
          aria-label="socket name"
          value={socket.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className={`w-0 flex-1 ${inputCls}`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="remove socket"
          className="rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {([0, 1, 2] as const).map((i) => (
          <input
            key={i}
            type="number"
            aria-label={["x", "y", "z"][i]}
            value={socket.position[i]}
            onChange={(e) => {
              const p: [number, number, number] = [...socket.position];
              p[i] = Number(e.target.value) || 0;
              onPatch({ position: p });
            }}
            className="w-full rounded border border-border bg-background/50 px-1.5 py-0.5 text-right outline-none focus:border-primary"
          />
        ))}
      </div>
      <input
        aria-label="socket tag"
        value={socket.tag}
        placeholder={tagPlaceholder}
        onChange={(e) => onPatch({ tag: e.target.value })}
        className={`w-full ${inputCls}`}
      />
    </div>
  );
}
