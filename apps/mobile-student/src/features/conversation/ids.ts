/** UUIDv7 generation kept local so retry IDs survive one controller lifetime. */

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  // Expo loads `react-native-get-random-values` before this feature. This tiny
  // fallback only keeps tests/non-RN previews from crashing; production always
  // has Web Crypto through that polyfill.
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Math.floor(Math.random() * 256);
  return bytes;
}

/** RFC 9562 UUIDv7: timestamp-sortable and valid for the callable schemas. */
export function createConversationUuid(): string {
  const bytes = randomBytes();
  const timestamp = Date.now();

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = (timestamp / 2 ** ((5 - index) * 8)) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Small non-reversible marker: persistence never stores a second pending body. */
export function hashConversationText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** Hash the exact safe retry envelope; it is a corruption guard, not a secret. */
export function hashConversationInput(value: unknown): string {
  return hashConversationText(JSON.stringify(value));
}
