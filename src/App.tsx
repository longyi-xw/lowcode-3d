import { useAppViewStore } from "@/services/app-view/store";
import { AppSettingsEffects } from "@/services/settings/effects";
import { useCommandHistoryShortcuts } from "@/services/command-history/use-keyboard-shortcuts";
import { useProjectMenu } from "@/services/project/use-project-menu";
import { useWindowTitle } from "@/services/project/use-window-title";
import { StartupView } from "@/ui/views/StartupView";
import { LoadingView } from "@/ui/views/LoadingView";
import { EditorView } from "@/ui/views/EditorView";
import { ErrorView } from "@/ui/views/ErrorView";
import { NewProjectDialog } from "@/ui/project/NewProjectDialog";

function App() {
  const view = useAppViewStore((s) => s.view);
  useCommandHistoryShortcuts();
  useProjectMenu();
  useWindowTitle();

  return (
    <>
      <AppSettingsEffects />
      {view === "startup" && <StartupView />}
      {view === "loading" && <LoadingView />}
      {view === "editor" && <EditorView />}
      {view === "error" && <ErrorView />}
      <NewProjectDialog />
    </>
  );
}

export default App;
