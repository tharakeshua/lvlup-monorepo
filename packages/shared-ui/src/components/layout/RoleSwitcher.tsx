import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantOption {
  tenantId: string;
  tenantName: string;
  role: string;
  logoUrl?: string;
}

export interface RoleSwitcherProps {
  currentTenantId: string | null;
  tenants: TenantOption[];
  onSwitch: (tenantId: string) => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleSwitcher({ currentTenantId, tenants, onSwitch, loading }: RoleSwitcherProps) {
  const currentTenant = tenants.find((t) => t.tenantId === currentTenantId);

  if (tenants.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2" disabled={loading}>
          <Building2 className="size-4 shrink-0" />
          <span className="truncate text-sm">{currentTenant?.tenantName ?? "Select school"}</span>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel>Switch school</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.tenantId}
            onClick={() => onSwitch(t.tenantId)}
            className="flex items-center gap-2"
          >
            {t.logoUrl ? (
              <img
                src={t.logoUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-5 rounded object-cover"
              />
            ) : (
              <Building2 className="size-4" />
            )}
            <div className="flex flex-1 flex-col">
              <span className="truncate text-sm">{t.tenantName}</span>
              <Badge variant="secondary" className="mt-0.5 w-fit text-[10px]">
                {t.role}
              </Badge>
            </div>
            {t.tenantId === currentTenantId && <Check className="text-primary ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
