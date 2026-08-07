import type { Meta, StoryObj } from "@storybook/html-vite";
import html from './cipher.html?raw';
import markdown from './spec.md?raw';
import { initCipher } from './cipher';
import createFeature from '@computerwwwizards/step-binder';
import { Actor, BrowseWithStorybook, PageElement, By, Clear, Enter, Click, Text, Ensure, isEqualTo } from '@computerwwwizards/screenplay-storybook';

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
    const actor = Actor.named("James").whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement })
    );

    //@ts-expect-error typing for later
    const hofStep = (cb: (injectedParams, ctx) => Promise<void> | void) => async (injectedParams, ctx) => {
      await step(ctx.currentStep.label, async () => await cb(injectedParams, ctx));
    };

    const textarea = PageElement.located(By.role("textbox"));

    const scenario = feature.Scenario("Text Encryption via Shift Execution Trigger", (Step) => {
      Step("Clear the active input text area container completely", hofStep(async () => {
        
        await actor.attemptsTo(
          Clear.theValueOf(textarea)
        );
      }));

      Step("Type the message {message} into the text field box", hofStep(async ({ message }) => {

        await actor.attemptsTo(
          Enter.theValue(message).into(textarea)
        );
      }));

      Step("Click the action button element with the name label {label}", hofStep(async ({ label }) => {
        const cipherButton = PageElement.located(By.role("button", { name: label }));
        await actor.attemptsTo(
          Click.on(cipherButton)
        );
      }));

      Step("Verify that the output element container {id} displays the encrypted text value {value}", hofStep(async ({ id, value }) => {
        const resultBox = PageElement.located(By.css(id));
        await actor.attemptsTo(
          Ensure.that(Text.of(resultBox), isEqualTo(value))
        );
      }));
    });
    
    await scenario.run();
  },
};
