import { z } from "zod";

/**
 * The ONE way to author an entity/object in @levelup/domain.
 * Always `.strict()`: rejects unknown/renamed fields at the boundary (the D12
 * drift killer). A lint test forbids raw `z.object(` in src/entities/**.
 */
export const zObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
