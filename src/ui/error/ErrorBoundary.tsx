import { Component, type ErrorInfo, type ReactNode } from "react";

import { CrashFallback } from "./CrashFallback";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return <CrashFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
