import type { StorageAdapter } from './types';
/**
 * In-memory adapter for tests and ephemeral runtimes.
 */
export declare class InMemoryStorageAdapter implements StorageAdapter {
    private readonly store;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}
