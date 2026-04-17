"use client";

import { Component, type ReactNode } from "react";

type Props = {
  readonly children: ReactNode;
};

type State = {
  readonly hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "var(--color-background, #000)",
            color: "var(--color-foreground, #fff)",
          }}
        >
          <p style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>
            Something went wrong.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 2rem",
              fontSize: "1rem",
              backgroundColor: "var(--color-accent, #ff2d2d)",
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
