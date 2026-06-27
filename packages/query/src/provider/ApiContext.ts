/** The React context holding the injected `ApiContextValue` (query-infra.md §3). */
import { createContext } from "react";
import type { ApiContextValue } from "./types.js";

export const ApiContext = createContext<ApiContextValue | null>(null);
