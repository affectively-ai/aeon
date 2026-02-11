/**
 * Persistence types for Aeon durable state.
 *
 * The adapter interface is intentionally minimal so consumers can map it to
 * local storage, WASM-backed stores, D1/R2 synchronization layers, or custom
 * encrypted stores without extra dependencies.
 */

/**
 * Minimal storage adapter interface.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

/**
 * Versioned envelope for persisted payloads.
 */
export interface PersistedEnvelope<T> {
  version: 1;
  updatedAt: number;
  data: T;
}

/**
 * Serialization hook for custom privacy/security implementations.
 */
export type PersistenceSerializer<T> = (value: PersistedEnvelope<T>) => string;

/**
 * Deserialization hook for custom privacy/security implementations.
 */
export type PersistenceDeserializer<T> = (
  raw: string,
) => PersistedEnvelope<T>;
