import * as React from "react";
import { Button } from "../ui/button";

export interface OrgSwitcherMembership {
  tenantId: string;
  tenantCode: string;
  role: string;
  tenantName: string;
}

export interface OrgSwitcherProps {
  currentTenantId: string | null;
  memberships: OrgSwitcherMembership[];
  onSwitch: (tenantId: string) => Promise<void>;
}

export function OrgSwitcher({ currentTenantId, memberships, onSwitch }: OrgSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Don't render if only one membership
  if (memberships.length <= 1) return null;

  const currentOrg = memberships.find((m) => m.tenantId === currentTenantId);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await onSwitch(tenantId);
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="max-w-[200px] truncate"
      >
        {switching ? "Switching..." : (currentOrg?.tenantName ?? "Select org")}
      </Button>

      {open && (
        <div className="bg-popover absolute left-0 top-full z-50 mt-1 w-64 rounded-md border p-1 shadow-md">
          {memberships.map((m) => (
            <button
              key={m.tenantId}
              onClick={() => handleSwitch(m.tenantId)}
              className={`hover:bg-accent flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors ${
                m.tenantId === currentTenantId ? "bg-accent font-medium" : ""
              }`}
            >
              <span className="truncate">{m.tenantName}</span>
              <span className="text-muted-foreground ml-2 text-xs capitalize">{m.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
