import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
} from "@levelup/shared-ui";
import { ArrowRight, CheckCircle2, CircleAlert, Globe, Loader2, ShieldCheck } from "lucide-react";
import { getReadinessProgress, type PublishReadinessItem } from "./space-authoring-model";

type AuthoringTab = "settings" | "content";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PublishReadinessItem[];
  onNavigate: (tab: AuthoringTab) => void;
  onPublish: () => Promise<void>;
  publishing: boolean;
}

export default function PublishReadinessDialog({
  open,
  onOpenChange,
  items,
  onNavigate,
  onPublish,
  publishing,
}: Props) {
  const incomplete = items.filter((item) => !item.ready);
  const progress = getReadinessProgress(items);
  const isReady = incomplete.length === 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !publishing && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="bg-success/10 text-success mb-2 flex h-11 w-11 items-center justify-center rounded-xl">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-display text-xl">Publish readiness</DialogTitle>
          <DialogDescription>
            Review the student-facing essentials before making this space available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-surface-sunken rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">
                  {isReady
                    ? "Ready to publish"
                    : `${incomplete.length} step${incomplete.length === 1 ? "" : "s"} left`}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {progress}% of the publishing checklist is complete.
                </p>
              </div>
              <span className="font-display text-2xl font-semibold" aria-hidden="true">
                {progress}%
              </span>
            </div>
            <Progress
              value={progress}
              className="mt-3 h-2"
              indicatorClassName={isReady ? "bg-success" : undefined}
              aria-label={`${progress}% publish ready`}
            />
          </div>

          <ul className="space-y-2" aria-label="Publishing checklist">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  item.ready ? "bg-success/5 border-success/20" : "bg-card border-subtle"
                }`}
              >
                {item.ready ? (
                  <CheckCircle2
                    className="text-success mt-0.5 h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleAlert
                    className="text-warning mt-0.5 h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {!item.ready && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-10 shrink-0"
                    onClick={() => {
                      onNavigate(item.tab);
                      onOpenChange(false);
                    }}
                  >
                    Fix
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {isReady && (
            <Alert className="border-success/30 bg-success/5" role="status">
              <ShieldCheck className="text-success h-4 w-4" />
              <AlertDescription>
                Publishing makes this space available according to its access settings. You can
                return it to draft later without losing student progress.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            type="button"
            onClick={onPublish}
            disabled={!isReady || publishing}
            className="bg-success text-fg-on-accent hover:bg-success/90"
          >
            {publishing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Globe className="h-4 w-4" aria-hidden="true" />
            )}
            {publishing ? "Publishing…" : "Publish space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
