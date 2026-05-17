function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">lowcode-3d</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          scaffold · v0.0.1-scaffold
        </p>
        <p className="mt-6 text-sm leading-relaxed">
          Tailwind + shadcn theme tokens are wired. Toggle{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            class=&quot;dark&quot;
          </code>{" "}
          on the <code className="font-mono">&lt;html&gt;</code> element to flip themes.
        </p>
      </div>
    </main>
  );
}

export default App;
