"use strict";
/**
 * LLM utilities for AutoGrade.
 *
 * Wraps the shared LLMWrapper from @levelup/shared-services.
 * Type declarations are local until shared-services ships compiled .d.ts files.
 *
 * TODO: Replace local type declarations with imports from @levelup/shared-services
 * once the package builds and publishes declaration files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMWrapper = void 0;
exports.getGeminiApiKey = getGeminiApiKey;
const secret_manager_1 = require("@google-cloud/secret-manager");
// ─── Dynamic import of LLMWrapper ────────────────────────────────────────────
// We use require() at runtime since shared-services is a workspace dep
// that points to raw .ts source. In production, it will be compiled.
// eslint-disable-next-line @typescript-eslint/no-var-requires
let _LLMWrapperClass;
function getLLMWrapperClass() {
  if (!_LLMWrapperClass) {
    try {
      // Try workspace import
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@levelup/shared-services/ai");
      _LLMWrapperClass = mod.LLMWrapper;
    } catch {
      // Fallback: try relative path (development)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require("../../../../packages/shared-services/src/ai");
        _LLMWrapperClass = mod.LLMWrapper;
      } catch {
        throw new Error(
          "Could not load LLMWrapper from @levelup/shared-services. Ensure the package is built."
        );
      }
    }
  }
  return _LLMWrapperClass;
}
/**
 * LLMWrapper class — proxy to shared-services implementation.
 */
class LLMWrapper {
  instance;
  constructor(config) {
    const Cls = getLLMWrapperClass();
    this.instance = new Cls(config);
  }
  async call(prompt, metadata, options) {
    return this.instance.call(prompt, metadata, options);
  }
}
exports.LLMWrapper = LLMWrapper;
// ─── Secret Manager helper ───────────────────────────────────────────────────
let smClient = null;
function getSmClient() {
  if (!smClient) {
    smClient = new secret_manager_1.SecretManagerServiceClient();
  }
  return smClient;
}
/**
 * Retrieve a tenant's Gemini API key from Secret Manager.
 */
async function getGeminiApiKey(tenantId) {
  const project = process.env["GCLOUD_PROJECT"] ?? process.env["GCP_PROJECT"];
  if (!project) {
    throw new Error("No GCP project ID. Set GCLOUD_PROJECT or GCP_PROJECT env var.");
  }
  const secretName = `tenant-${tenantId}-gemini`;
  const versionPath = `projects/${project}/secrets/${secretName}/versions/latest`;
  const [version] = await getSmClient().accessSecretVersion({ name: versionPath });
  const payload = version.payload?.data;
  if (!payload) {
    throw new Error(`Secret "${secretName}" has no payload data.`);
  }
  const key = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
  if (!key.trim()) throw new Error(`Secret "${secretName}" is empty.`);
  return key.trim();
}
//# sourceMappingURL=llm.js.map
