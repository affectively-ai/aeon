import { describe, it, expect } from 'vitest';
import { InMemoryStorageAdapter } from '../../persistence';

describe('Persistence Module', () => {
  it('should store and retrieve values', () => {
    const adapter = new InMemoryStorageAdapter();
    adapter.setItem('k1', 'v1');

    expect(adapter.getItem('k1')).toBe('v1');
  });

  it('should remove stored values', () => {
    const adapter = new InMemoryStorageAdapter();
    adapter.setItem('k1', 'v1');
    adapter.removeItem('k1');

    expect(adapter.getItem('k1')).toBeNull();
  });

  it('should clear all values', () => {
    const adapter = new InMemoryStorageAdapter();
    adapter.setItem('k1', 'v1');
    adapter.setItem('k2', 'v2');
    adapter.clear();

    expect(adapter.getItem('k1')).toBeNull();
    expect(adapter.getItem('k2')).toBeNull();
  });
});
