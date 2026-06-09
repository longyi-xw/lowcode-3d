import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommandHistoryStore } from "@/services/command-history/store";
import { useSceneStore } from "@/services/scene/store";
import type { SceneNode } from "@/core/scene/types";

import { SocketsSection } from "./SocketsSection";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function groupNode(sockets?: SceneNode["sockets"]): SceneNode {
  return {
    id: "n1",
    name: "n1",
    type: "group",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
    sockets,
  };
}

describe("SocketsSection", () => {
  beforeEach(() => {
    useSceneStore.setState({ project: null });
    useCommandHistoryStore.getState().clear();
  });

  it("shows an existing socket's name", () => {
    render(
      <SocketsSection
        node={groupNode([{ id: "s1", name: "top", position: [0, 1, 0], tag: "stud" }])}
      />,
    );
    expect(screen.getByDisplayValue("top")).toBeInTheDocument();
  });

  it("clicking add dispatches a node.sockets.set command", () => {
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    render(<SocketsSection node={groupNode([])} />);
    fireEvent.click(screen.getByTitle("Add socket"));
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.sockets.set" }),
      expect.anything(),
    );
  });
});
