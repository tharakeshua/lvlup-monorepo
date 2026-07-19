import { Component, type ReactNode } from "react";
import { Button } from "@levelup/shared-ui";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-6 text-center">
          <AlertTriangle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-sm font-medium">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
