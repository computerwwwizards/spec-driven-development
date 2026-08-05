
import type { Meta, StoryObj } from "storybook"; 
import { expect } from "storybook/test";
import html from './cipher.html?raw';
import markdown from './spec.md?raw';
import { initCipher } from './cipher';
import createFeature from '../src/create-feature';

const feature = createFeature(markdown);

const meta: Meta = {
  title: "Components/Cipher",
  tags: ["autodocs"],
  render: () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const templateNode = doc.querySelector("template");

    if (!templateNode) return "Error: Template missing.";

    const componentFragment = templateNode.content.cloneNode(true) as DocumentFragment;
    initCipher(componentFragment);

    return componentFragment;
  },
};

export default meta;

type Story = StoryObj;

export const Primary: Story = {
  play: async ({ canvas, userEvent, canvasElement, step }) => {
    const textarea = canvas.getByRole("textbox");

    const hofStep = (cb) => async (injectedParams, ctx)=>{
      await step(ctx.currentStep.label, async ()=>await cb(injectedParams, ctx))
    }

    feature.Scenario("Text Encryption via Shift Execution Trigger", (Step) => {
      Step("Clear the active input text area container completely", hofStep(async (_, { currentStep }) => {
        await userEvent.clear(textarea);
      }));

      Step("Type the message {message} into the text field box", hofStep(async ({ message }) => {
        await userEvent.type(textarea, message);
      }));

      Step("Click the action button element with the name label {label}",hofStep(async ({ label }) => {
        const cipherButton = canvas.getByRole("button", { name: label });
        await userEvent.click(cipherButton);
      }));

      Step("Verify that the output element container {id} displays the encrypted text value {value}", hofStep(async ({ id, value }) => {
        const resultBox = canvasElement.querySelector(id); 
        await expect(resultBox?.textContent).toBe(value);
      }));
    });
    
    for (const scenario of feature.scenarios.values()) {
      await scenario.run();
    }
  },
};
