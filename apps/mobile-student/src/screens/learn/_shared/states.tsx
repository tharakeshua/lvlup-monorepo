/**
 * Shared loading / error / empty presentation for the Learn screens, so all
 * three render identical states. Thin compositions over the component barrel.
 */
import { View } from "react-native";

import { Alert, Button, Icon, Screen, Skeleton } from "../../../components";

/** Full-screen card-grid skeleton (spaces-list + any list screen). */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="gap-4 p-5">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="border-border-subtle bg-surface gap-3 rounded-lg border p-4">
          <Skeleton width="100%" height={72} radius={10} />
          <Skeleton width="45%" height={18} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={12} />
        </View>
      ))}
    </View>
  );
}

/** Detail skeleton: a hero block + a vertical stack of node skeletons. */
export function DetailSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className="gap-4 p-5">
      <Skeleton width="60%" height={28} />
      <Skeleton width="90%" height={14} />
      <Skeleton width="100%" height={12} radius={999} />
      <View className="h-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width="100%" height={84} radius={14} />
      ))}
    </View>
  );
}

/** A standalone error state with a retry affordance. */
export function ErrorState({
  title = "Something went wrong",
  body = "It's not you — let's try that again.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <Screen className="bg-canvas" contentClassName="flex-1 justify-center p-6">
      <Alert variant="error" title={title} icon={<Icon name="cloud-off" size={20} />}>
        {body}
      </Alert>
      {onRetry ? (
        <View className="mt-4 items-start">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="refresh-cw" size={16} />}
            onPress={onRetry}
          >
            Try again
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}
