'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.InMemoryStorageAdapter = void 0;
/**
 * In-memory adapter for tests and ephemeral runtimes.
 */
class InMemoryStorageAdapter {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
  removeItem(key) {
    this.store.delete(key);
  }
  async flushSync() {
    /* noop */
  }
  clear() {
    this.store.clear();
  }
}
exports.InMemoryStorageAdapter = InMemoryStorageAdapter;
//# sourceMappingURL=InMemoryStorageAdapter.js.map
