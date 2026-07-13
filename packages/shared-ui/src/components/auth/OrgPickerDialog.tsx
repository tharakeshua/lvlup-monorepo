import * as React from "react";
import { Button } from "../ui/button";

export interface OrgPickerMembership {
  tenantId: string;
  tenantCode: string;
  role: string;
  tenantName: string;
}

export interface OrgPickerDialogProps {
  open: boolean;
  memberships: OrgPickerMembership[];
  onSelect: (tenantId: string) => Promise<void>;
}

export function OrgPickerDialog({ open, memberships, onSelect }: OrgPickerDialogProps) {
  const [selecting, setSelecting] = React.useState<string | null>(null);

  if (!open) return null;

  const handleSelect = async (tenantId: string) => {
    setSelecting(tenantId);
    try {
      await onSelect(tenantId);
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-6 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Select Organization</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            You belong to multiple organizations. Choose one to continue.
          </p>
        </div>

        <div className="grid gap-3">
          {memberships.map((m) => (
            <button
              key={m.tenantId}
              onClick={() => handleSelect(m.tenantId)}
              disabled={selecting !== null}
              className="bg-card shadow-card hover:bg-accent flex items-center justify-between rounded-lg border p-4 text-left transition-colors disabled:opacity-50"
            >
              <div>
                <p className="font-semibold">{m.tenantName}</p>
                <p className="text-muted-foreground text-sm capitalize">
                  {m.role} &middot; {m.tenantCode}
                </p>
              </div>
              {selecting === m.tenantId ? (
                <span className="text-muted-foreground text-sm">Loading...</span>
              ) : (
                <Button variant="outline" size="sm" tabIndex={-1}>
                  Select
                </Button>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
