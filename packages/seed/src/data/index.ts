/**
 * The bundled mock dataset — a FULL, cross-referenced SeedConfig exercising every entity type.
 *
 * It is split per tenant subtree for readability; `mockSeedConfig` composes them. Logical keys
 * are stable and human-readable so the deterministic ids stay reproducible.
 */

import type { SeedConfig } from "../config/types.js";
import { greenwoodTenant } from "./greenwood.js";
import { riversideTenant } from "./riverside.js";
import { demoSuperAdmin, demoTenant } from "./identity.js";
import { autogradeTenant } from "./autograde.js";
import { contentLevelupTenant } from "./content-levelup.js";

export const mockSeedConfig: SeedConfig = {
  version: "1.0.0",
  superAdmins: [
    demoSuperAdmin,
    {
      key: "platform-owner",
      email: "owner@levelup.dev",
      password: "SuperAdmin@123",
      displayName: "Platform Owner",
    },
  ],
  globalEvaluationPresets: [
    {
      key: "default-essay",
      name: "Default Essay Rubric",
      description: "Platform-wide essay grading preset",
      status: "active",
      rubric: {
        dimensions: [
          {
            key: "content",
            label: "Content & Accuracy",
            weight: 0.5,
            promptGuidance: "Reward correct, complete reasoning.",
          },
          { key: "clarity", label: "Clarity", weight: 0.3 },
          { key: "structure", label: "Structure", weight: 0.2 },
        ],
        totalPoints: 10,
        passingScore: 6,
      },
    },
  ],
  tenants: [demoTenant, greenwoodTenant, riversideTenant, autogradeTenant, contentLevelupTenant],
};

export { greenwoodTenant, riversideTenant, autogradeTenant, contentLevelupTenant };
export { demoSuperAdmin, demoTenant } from "./identity.js";
