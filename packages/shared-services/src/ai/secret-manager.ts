/**
 * Secret Manager — GCP Secret Manager key retrieval for per-tenant Gemini API keys.
 *
 * Architecture (from docs/BLUEPRINT-REVIEW-RESPONSES-AND-EXTENSIONS.md §1.1):
 *   - Keys stored in Secret Manager at: projects/{project}/secrets/tenant-{tenantId}-gemini
 *   - Cloud Functions service account has secretmanager.secretAccessor IAM role
 *   - Keys are NEVER stored in Firestore or client bundles
 */

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!client) {
    client = new SecretManagerServiceClient();
  }
  return client;
}

/**
 * Derive the Secret Manager secret name for a tenant's Gemini API key.
 * Pattern: `tenant-{tenantId}-gemini`
 */
export function getSecretName(tenantId: string): string {
  return `tenant-${tenantId}-gemini`;
}

/**
 * Retrieve a tenant's Gemini API key from Google Cloud Secret Manager.
 *
 * @param tenantId - The tenant whose key to retrieve
 * @param projectId - GCP project ID (defaults to GCLOUD_PROJECT / GCP_PROJECT env var)
 * @returns The plaintext API key
 * @throws If the secret does not exist or cannot be accessed
 */
export async function getGeminiApiKey(tenantId: string, projectId?: string): Promise<string> {
  // 1. Check environment variable first (simplest, no IAM needed)
  const envKey = process.env["GEMINI_API_KEY"];
  if (envKey?.trim()) {
    return envKey.trim();
  }

  // 2. Fall back to Secret Manager
  const project = projectId ?? process.env["GCLOUD_PROJECT"] ?? process.env["GCP_PROJECT"];
  if (!project) {
    throw new Error(
      "[SecretManager] No GEMINI_API_KEY env var and no GCP project ID. Set GEMINI_API_KEY or GCLOUD_PROJECT."
    );
  }

  const secretName = getSecretName(tenantId);
  const versionPath = `projects/${project}/secrets/${secretName}/versions/latest`;

  const smClient = getClient();
  const [version] = await smClient.accessSecretVersion({ name: versionPath });

  const payload = version.payload?.data;
  if (!payload) {
    throw new Error(`[SecretManager] Secret "${secretName}" has no payload data.`);
  }

  // payload can be string | Uint8Array
  const key = typeof payload === "string" ? payload : new TextDecoder().decode(payload);

  if (!key.trim()) {
    throw new Error(`[SecretManager] Secret "${secretName}" is empty.`);
  }

  return key.trim();
}

/**
 * Store (or update) a tenant's Gemini API key in Secret Manager.
 * Creates the secret if it doesn't exist, otherwise adds a new version.
 */
export async function setGeminiApiKey(
  tenantId: string,
  apiKey: string,
  projectId?: string
): Promise<void> {
  const project = projectId ?? process.env["GCLOUD_PROJECT"] ?? process.env["GCP_PROJECT"];
  if (!project) {
    throw new Error(
      "[SecretManager] No GCP project ID provided. Set GCLOUD_PROJECT or GCP_PROJECT env var."
    );
  }

  const secretName = getSecretName(tenantId);
  const parent = `projects/${project}`;
  const smClient = getClient();

  // Try to create the secret; if it already exists, just add a new version
  try {
    await smClient.createSecret({
      parent,
      secretId: secretName,
      secret: { replication: { automatic: {} } },
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    // 6 = ALREADY_EXISTS — that's fine, we'll add a version
    if (code !== 6) throw err;
  }

  // Add a new version with the key payload
  await smClient.addSecretVersion({
    parent: `${parent}/secrets/${secretName}`,
    payload: { data: Buffer.from(apiKey, "utf-8") },
  });
}

/**
 * Delete a tenant's Gemini API key from Secret Manager entirely.
 */
export async function deleteGeminiApiKey(tenantId: string, projectId?: string): Promise<void> {
  const project = projectId ?? process.env["GCLOUD_PROJECT"] ?? process.env["GCP_PROJECT"];
  if (!project) {
    throw new Error(
      "[SecretManager] No GCP project ID provided. Set GCLOUD_PROJECT or GCP_PROJECT env var."
    );
  }

  const secretName = getSecretName(tenantId);
  const smClient = getClient();

  await smClient.deleteSecret({
    name: `projects/${project}/secrets/${secretName}`,
  });
}

/**
 * Override the Secret Manager client (useful for testing).
 */
export function _setClientForTesting(mockClient: SecretManagerServiceClient): void {
  client = mockClient;
}
