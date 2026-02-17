import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'offline/index': 'src/offline/index.ts',
    'compression/index': 'src/compression/index.ts',
    'optimization/index': 'src/optimization/index.ts',
    'presence/index': 'src/presence/index.ts',
    'versioning/index': 'src/versioning/index.ts',
    'distributed/index': 'src/distributed/index.ts',
    'utils/index': 'src/utils/index.ts',
    'crypto/index': 'src/crypto/index.ts',
    'persistence/index': 'src/persistence/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['eventemitter3', '@affectively/aeon-flux-react'],
  outDir: 'dist',
  target: 'es2022',
});
