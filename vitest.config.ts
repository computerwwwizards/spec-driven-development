import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/spec-glue',
      'packages/screenplay-storybook',
    ],
  },
});
