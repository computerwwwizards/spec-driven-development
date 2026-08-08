import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/create-feature.ts',
    },
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: { bundle: true },
    },
  ],
  output: {
    target: 'web',
    cleanDistPath: true,
  },
});
