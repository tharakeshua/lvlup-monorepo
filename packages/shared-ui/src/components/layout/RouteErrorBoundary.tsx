import { Component, type ReactNode } from "react";
import { Button } from "../ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="text-destructive h-10 w-10" />
          <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button className="mt-4" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
