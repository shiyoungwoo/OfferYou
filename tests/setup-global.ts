// Polyfill crypto.randomUUID for jsdom test environment
if (typeof globalThis.crypto === "undefined") {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== "function") {
  let counter = 0;
  (globalThis as any).crypto.randomUUID = () => `test-uuid-${++counter}`;
}
