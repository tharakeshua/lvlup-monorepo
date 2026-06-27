// @levelup/domain — the ONLY public surface (barrel). Bottom of the trust-layered
// cake: zero upward deps, zero platform coupling. `zod` is the only runtime dep.

// primitives
export * from "./primitives/brand.js";
export * from "./primitives/branded-id.zod.js";
export * from "./primitives/timestamp.js";
export * from "./primitives/timestamp.zod.js";
export * from "./primitives/iso-date.js";
export * from "./primitives/iso-date.zod.js";
export * from "./primitives/money.js";
export * from "./primitives/money.zod.js";
export * from "./primitives/page.js";
export * from "./primitives/page.zod.js";
export * from "./primitives/audit.js";
export * from "./primitives/audit.zod.js";
export * from "./primitives/json.js";
export * from "./primitives/json.zod.js";

// authoring
export * from "./authoring/strict.js";
export * from "./authoring/infer.js";

// enums
export * from "./enums/index.js";

// transitions
export * from "./transitions/index.js";

// entities
export * from "./entities/index.js";
