import * as React from "react";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";

export interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  /** Return an error message string to show validation error, or undefined if valid */
  validate?: (value: string) => string | undefined;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function InlineEdit({
  value,
  onSave,
  validate,
  placeholder = "Enter value...",
  className,
  inputClassName,
  disabled = false,
  "aria-label": ariaLabel = "Editable field",
}: InlineEditProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string>();
  const [saved, setSaved] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const startEditing = () => {
    if (disabled) return;
    setDraft(value);
    setError(undefined);
    setEditing(true);
  };

  const save = () => {
    const validationError = validate?.(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(draft);
    setEditing(false);
    setError(undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
    setError(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(undefined);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("h-8", error && "border-destructive", inputClassName)}
            aria-label={ariaLabel}
            aria-invalid={!!error}
            aria-describedby={error ? "inline-edit-error" : undefined}
          />
          {error && (
            <p id="inline-edit-error" className="text-destructive mt-1 text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-success h-8 w-8 shrink-0"
          onClick={save}
          aria-label="Save"
          type="button"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8 shrink-0"
          onClick={cancel}
          aria-label="Cancel"
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("group flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={startEditing}
        disabled={disabled}
        className={cn(
          "hover:bg-muted focus-visible:ring-ring inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-label={`Edit ${ariaLabel}: ${value}`}
      >
        <span>{value || placeholder}</span>
        <Pencil
          className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </button>
      {saved && (
        <span className="text-success text-xs" aria-live="polite">
          Saved
        </span>
      )}
    </div>
  );
}
