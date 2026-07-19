import * as React from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Badge } from "./ui/badge";

export interface EntityPickerItem {
  id: string;
  label: string;
  description?: string;
}

interface EntityPickerProps {
  items: EntityPickerItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EntityPicker({
  items,
  selected,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  multiple = true,
  disabled = false,
  className,
}: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedItems = items.filter((item) => selected.includes(item.id));

  const handleSelect = (itemId: string) => {
    if (multiple) {
      if (selected.includes(itemId)) {
        onChange(selected.filter((id) => id !== itemId));
      } else {
        onChange([...selected, itemId]);
      }
    } else {
      onChange([itemId]);
      setOpen(false);
    }
  };

  const handleRemove = (itemId: string) => {
    onChange(selected.filter((id) => id !== itemId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {selectedItems.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedItems.map((item) => (
                <Badge key={item.id} variant="secondary" className="text-xs">
                  {item.label}
                  {multiple && (
                    <button
                      className="hover:bg-muted ml-1 rounded-full outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full min-w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.label}
                  onSelect={() => handleSelect(item.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(item.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div>
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-muted-foreground ml-2 text-xs">{item.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
