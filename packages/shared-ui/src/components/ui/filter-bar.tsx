import * as React from "react";
import { X, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { useIsMobile } from "../../hooks/use-mobile";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "search";
  options?: FilterOption[];
  placeholder?: string;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

export interface FilterBarProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

function FilterControls({
  fields,
  values,
  onChange,
}: Pick<FilterBarProps, "fields" | "values" | "onChange">) {
  return (
    <>
      {fields.map((field) => {
        if (field.type === "search") {
          return (
            <div key={field.key} className="relative">
              <Search
                className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                placeholder={field.placeholder ?? `Search ${field.label.toLowerCase()}...`}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="h-9 w-full pl-9 sm:w-[200px]"
                aria-label={field.label}
              />
            </div>
          );
        }

        if (field.type === "select" && field.options) {
          return (
            <Select
              key={field.key}
              value={values[field.key] ?? ""}
              onValueChange={(v) => onChange(field.key, v)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label={field.label}>
                <SelectValue placeholder={field.placeholder ?? field.label} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        return null;
      })}
    </>
  );
}

export function FilterBar({
  fields,
  values,
  onChange,
  onClear,
  onClearAll,
  className,
}: FilterBarProps) {
  const isMobile = useIsMobile();

  const activeFilters: ActiveFilter[] = fields
    .filter((f) => values[f.key])
    .map((f) => {
      const displayValue =
        f.type === "select"
          ? (f.options?.find((o) => o.value === values[f.key])?.label ?? values[f.key])
          : values[f.key];
      return {
        key: f.key,
        label: f.label,
        value: values[f.key],
        displayValue,
      };
    });

  const filterCount = activeFilters.length;

  return (
    <div className={cn("space-y-2", className)}>
      {isMobile ? (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filters
              {filterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                  {filterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="space-y-4">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              <FilterControls fields={fields} values={values} onChange={onChange} />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <FilterControls fields={fields} values={values} onChange={onChange} />
        </div>
      )}

      {/* Active filter chips */}
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite" aria-atomic="true">
          <span className="text-muted-foreground text-xs">
            {filterCount} filter{filterCount !== 1 ? "s" : ""} active:
          </span>
          {activeFilters.map((filter) => (
            <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
              <span className="text-xs">
                {filter.label}: {filter.displayValue}
              </span>
              <button
                onClick={() => onClear(filter.key)}
                className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                aria-label={`Remove ${filter.label} filter`}
                type="button"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {onClearAll && filterCount > 1 && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 px-2 text-xs">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
