import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn("relative", containerClassName)}>
      <Search
        className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input ref={ref} className={cn("pl-9", className)} {...props} />
    </div>
  )
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
