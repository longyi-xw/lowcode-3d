import { useAppViewStore } from "@/services/app-view/store";
import { AppSettingsEffects } from "@/services/settings/effects";
import { useCommandHistoryShortcuts } from "@/services/command-history/use-keyboard-shortcuts";
import { StartupView } from "@/ui/views/StartupView";
import { LoadingView } from "@/ui/views/LoadingView";
import { EditorView } from "@/ui/views/EditorView";
import { ErrorView } from "@/ui/views/ErrorView";

function App() {
  const view = useAppViewStore((s) => s.view);
  useCommandHistoryShortcuts();

  return (
    <>
      <AppSettingsEffects />
      {view === "startup" && <StartupView />}
      {view === "loading" && <LoadingView />}
      {view === "editor" && <EditorView />}
      {view === "error" && <ErrorView />}
    </>
  );
}

export default App;
