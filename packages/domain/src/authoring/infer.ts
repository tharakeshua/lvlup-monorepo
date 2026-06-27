import type { z } from "zod";

/** Output type (post-transform: branded). */
export type Infer<S extends z.ZodTypeAny> = z.infer<S>;

/** Input type (pre-transform). */
export type InferIn<S extends z.ZodTypeAny> = z.input<S>;
