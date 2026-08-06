import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { vitestWebContainers } from "@webcontainer/test/plugin";
import { preview }from '@vitest/browser-preview'

export default defineConfig({
  plugins: [
    // vitestWebContainers(),
    // storybookTest({
    //   configDir: ".storybook",
    // }),
  ],
  test: {
    testTimeout: 3000, 
    // include: ["./examples/**/*.stories.?(c|m)[jt]s?(x)"],
    // browser: {
    //   enabled: true,
    //   name: "chromium",
    //   provider: preview(),
    //   instances: [
    //     { browser: "chromium" }
    //   ]
    // },
  },
});