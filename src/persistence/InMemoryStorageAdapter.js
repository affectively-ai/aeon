/**
 * In-memory adapter for tests and ephemeral runtimes.
 */
export class InMemoryStorageAdapter {
    store = new Map();
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
