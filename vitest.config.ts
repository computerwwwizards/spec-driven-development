import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/step-binder',
      'packages/screenplay-storybook',
    ],
  },
});
