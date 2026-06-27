/**
 * Per-screen error boundary (safety net + dev diagnostics).
 *
 * `SdkProvider` turns OFF `throwReadErrorsToBoundary`, so data reads no longer
 * throw to the root — but a render-time exception still could. This boundary
 * wraps every screen so one bad screen degrades to a friendly card instead of
 * red-screening the whole app.
 *
 * In __DEV__ the fallback ALSO surfaces the caught error's message AND the React
 * component stack on-screen (Hermes console only reaches the Metro terminal,
 * which an on-device tester can't read). The component stack's top frames name
 * the exact component that threw — essential when the thrower is a 3rd-party
 * component deep in a render kit (e.g. a navigation-context error with no
 * `useNavigation` call anywhere in app code).
 */
import { Component, type ComponentType, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { asApiError, type NormalizedApiError } from "@levelup/query";

import { Button, Card, Icon, Screen } from "../components";

interface BoundaryState {
  error: NormalizedApiError | null;
  componentStack: string;
}

/** First N meaningful frames of a React component stack (top = nearest thrower). */
function topFrames(stack: string, n = 8): string {
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, n)
    .join("\n");
}

class ScreenErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error: asApiError(error) };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }): void {
    const componentStack = info?.componentStack ?? "";
    this.setState({ componentStack });
    // Also goes to Metro for anyone who can read it.
    console.error(
      `[ScreenBoundary] ${asApiError(error).message}\nComponentStack:${componentStack}`
    );
  }

  reset = (): void => this.setState({ error: null, componentStack: "" });

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    return (
      <Screen className="bg-canvas" contentClassName="p-5">
        <View className="py-12">
          <Card className="items-center gap-3 py-8">
            <Icon name="cloud-off" size={28} color="#756E61" />
            <Text className="font-display text-text-primary text-base">This screen hit a snag</Text>
            <Text className="text-text-muted px-6 text-center text-sm">
              Something didn’t load right — this one’s on us, not you. Give it another go.
            </Text>
            {error.retryable !== false ? (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="rotate-cw" size={15} />}
                onPress={this.reset}
              >
                Try again
              </Button>
            ) : null}
            {__DEV__ ? (
              <View className="bg-surface-sunken mt-3 w-full rounded-md p-3">
                <Text className="text-2xs text-error font-mono">
                  [{error.code}] {error.message}
                </Text>
                {componentStack ? (
                  <ScrollView style={{ maxHeight: 160 }} className="mt-2">
                    <Text className="text-2xs text-text-muted font-mono">
                      {topFrames(componentStack)}
                    </Text>
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
          </Card>
        </View>
      </Screen>
    );
  }
}

/** Wrap a screen component so a residual render throw degrades gracefully. */
export function withScreenBoundary<P extends object>(Comp: ComponentType<P>): ComponentType<P> {
  function Wrapped(props: P) {
    return (
      <ScreenErrorBoundary>
        <Comp {...props} />
      </ScreenErrorBoundary>
    );
  }
  Wrapped.displayName = `withScreenBoundary(${Comp.displayName ?? Comp.name ?? "Screen"})`;
  return Wrapped;
}
