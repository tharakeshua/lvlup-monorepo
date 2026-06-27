import { useMemo, useState } from "react";
import { useClasses } from "@levelup/query";
import { Badge, Button, Input, Popover, PopoverContent, PopoverTrigger } from "@levelup/shared-ui";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import ClassFormDialog from "../class/ClassFormDialog";

interface ClassMultiSelectProps {
  tenantId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface ClassRow {
  id: string;
  name: string;
  status?: string;
  grade?: string;
  section?: string;
}

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

export default function ClassMultiSelect({
  tenantId,
  value,
  onChange,
  disabled,
  placeholder = "Select classes...",
}: ClassMultiSelectProps) {
  // Query hooks are claims-scoped server-side — no tenantId arg.
  const { data, isLoading } = useClasses();
  const allClasses = useMemo(() => asArray<ClassRow>(data), [data]);
  const classes = useMemo(() => allClasses.filter((c) => c.status === "active"), [allClasses]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selectedClasses = useMemo(
    () => classes.filter((c) => value.includes(c.id)),
    [classes, value]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return classes;
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.grade ?? "").toLowerCase().includes(term) ||
        (c.section ?? "").toLowerCase().includes(term)
    );
  }, [classes, search]);

  const toggle = (classId: string) => {
    if (value.includes(classId)) {
      onChange(value.filter((id) => id !== classId));
    } else {
      onChange([...value, classId]);
    }
  };

  const remove = (classId: string) => {
    onChange(value.filter((id) => id !== classId));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground truncate">
              {value.length === 0
                ? placeholder
                : `${value.length} class${value.length === 1 ? "" : "es"} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b p-2">
            <Input
              type="text"
              placeholder="Search classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <p className="text-muted-foreground py-3 text-center text-xs">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-xs">
                {classes.length === 0 ? "No classes yet" : "No matches"}
              </p>
            ) : (
              filtered.map((cls) => {
                const isSelected = value.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggle(cls.id)}
                    className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                  >
                    <span className="border-input flex h-4 w-4 items-center justify-center rounded border">
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{cls.name}</span>
                    <span className="text-muted-foreground text-xs">
                      Grade {cls.grade}
                      {cls.section ? ` · ${cls.section}` : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Create new class
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {selectedClasses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedClasses.map((cls) => (
            <Badge key={cls.id} variant="secondary" className="gap-1 pr-1">
              {cls.name}
              <button
                type="button"
                onClick={() => remove(cls.id)}
                className="hover:bg-muted-foreground/20 ml-0.5 rounded p-0.5"
                aria-label={`Remove ${cls.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {tenantId && (
        <ClassFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          tenantId={tenantId}
          onSaved={(newClassId) => {
            onChange([...value, newClassId]);
          }}
        />
      )}
    </div>
  );
}
