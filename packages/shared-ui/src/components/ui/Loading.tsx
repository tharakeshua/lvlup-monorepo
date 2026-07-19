import { Loader2 } from "lucide-react";

const Loading = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex h-full min-h-[50vh] w-full items-center justify-center"
  >
    <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
    <span className="sr-only">Loading</span>
  </div>
);

export default Loading;
