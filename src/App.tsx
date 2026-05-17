import { useAppViewStore } from "@/services/app-view/store";
import { AppSettingsEffects } from "@/services/settings/effects";
import { StartupView } from "@/ui/views/StartupView";
import { LoadingView } from "@/ui/views/LoadingView";
import { EditorView } from "@/ui/views/EditorView";
import { ErrorView } from "@/ui/views/ErrorView";

function App() {
  const view = useAppViewStore((s) => s.view);

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
