import { Component, type ReactNode } from "react";
import { recoveryMessage, retryApplication, retryLabel } from "./startup";

export class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="design3-alert">
        <p role="alert">{recoveryMessage}</p>
        <button type="button" onClick={() => void retryApplication()}>
          {retryLabel}
        </button>
      </main>
    );
  }
}
