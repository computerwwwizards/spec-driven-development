import type { Meta, StoryObj } from "storybook"; 
import { expect } from "storybook/test";
import html from './cipher.html?raw';
import markdown from './spec.md?raw';
import { initCipher } from './cipher';
import createFeature from '../src/create-feature';
import { actorCalled } from '@serenity-js/core';
import { Clear, Enter, Click, Text, By, PageElement } from '@serenity-js/web';
import { Ensure, equals } from '@serenity-js/assertions';
import { BrowseTheWebWithStorybook } from './serenity';

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
    const actor = actorCalled('User')
      .whoCan(BrowseTheWebWithStorybook.using(canvas, userEvent, canvasElement));

    const hofStep = (cb) => async (injectedParams, ctx) => {
      await step(ctx.currentStep.label, async () => await cb(injectedParams, ctx))
    }

    const textareaField = PageElement.located(By.role('textbox'));

    const scenario = feature.Scenario("Text Encryption via Shift Execution Trigger", (Step) => {
      Step("Clear the active input text area container completely", hofStep(async () => {
        await actor.attemptsTo(
          Clear.theValueOf(textareaField)
        );
      }));

      Step("Type the message {message} into the text field box", hofStep(async ({ message }) => {
        await actor.attemptsTo(
          Enter.theValue(message).into(textareaField)
        );
      }));

      Step("Click the action button element with the name label {label}", hofStep(async ({ label }) => {
        await actor.attemptsTo(
          Click.on(PageElement.located(By.role('button', { name: label })))
        );
      }));

      Step("Verify that the output element container {id} displays the encrypted text value {value}", hofStep(async ({ id, value }) => {
        const cleanId = id.startsWith('#') ? id.slice(1) : id;
        await actor.attemptsTo(
          Ensure.that(Text.of(PageElement.located(By.id(cleanId))), equals(value))
        );
      }));
    });
    
    await scenario.run()
  },
};
