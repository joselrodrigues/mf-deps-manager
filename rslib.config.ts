import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2021',
      dts: true,
      output: {
        distPath: {
          root: './dist',
        },
      },
    },
  ],
});
