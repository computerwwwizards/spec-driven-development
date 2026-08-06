// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Click, Enter, Clear, Value, Text, By, PageElement, PageElements } from '@serenity-js/web';
import { StorybookActor } from '../examples/serenity';
import { userEvent, within } from 'storybook/test';
import { Primary } from '../examples/example.stories';
import { initCipher } from '../examples/cipher';
import html from '../examples/cipher.html?raw';

describe('Storybook Serenity Web Adapter', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.innerHTML = `
            <form id="my-form">
                <textarea id="my-textarea" name="content"></textarea>
                <button type="button" name="action" value="cipher">Cipher</button>
                <button type="button" name="action" value="disabled-btn" disabled>Disabled</button>
            </form>
            <div id="result">Initial Text</div>
            <select id="my-select" multiple>
                <option value="1" selected>Option 1</option>
                <option value="2">Option 2</option>
            </select>
            <ul class="items">
                <li>Item A</li>
                <li>Item B</li>
            </ul>
        `;
        document.body.appendChild(container);

        return () => {
            document.body.removeChild(container);
        };
    });

    it('should locate elements and perform standard Screenplay interactions and questions', async () => {
        const textarea = container.querySelector('#my-textarea') as HTMLTextAreaElement;
        const button = container.querySelector('button') as HTMLButtonElement;

        const canvas = within(container);

        const actor = new StorybookActor('Tester', canvas, userEvent, container);

        // 1. Test Enter.theValue
        const textareaElement = PageElement.located(By.id('my-textarea'));
        await actor.attemptsTo(
            Enter.theValue('Hello World!').into(textareaElement)
        );
        expect(textarea.value).toBe('Hello World!');

        // 2. Test Value.of
        const value = await actor.answer(Value.of(textareaElement));
        expect(value).toBe('Hello World!');

        // 3. Test Clear.theValueOf
        await actor.attemptsTo(
            Clear.theValueOf(textareaElement)
        );
        expect(textarea.value).toBe('');

        // 4. Test Click.on
        let clicked = false;
        button.addEventListener('click', () => {
            clicked = true;
        });
        await actor.attemptsTo(
            Click.on(PageElement.located(By.css('button')))
        );
        expect(clicked).toBe(true);

        // 5. Test Text.of
        const resultElement = PageElement.located(By.id('result'));
        const textValue = await actor.answer(Text.of(resultElement));
        expect(textValue).toBe('Initial Text');

        // 6. Test By.role
        const buttonByRole = PageElement.located(By.role('button', { name: 'Cipher' }));
        expect(await actor.answer(buttonByRole.isPresent())).toBe(true);

        // 7. Test By.cssContainingText
        const textElement = PageElement.located(By.cssContainingText('div', 'Initial'));
        expect(await actor.answer(textElement.isPresent())).toBe(true);
        expect(await actor.answer(textElement.text())).toBe('Initial Text');

        // 8. Test PageElements (multiple elements)
        const listItems = PageElements.located(By.css('ul.items li'));
        const itemsText = await actor.answer(Text.ofAll(listItems));
        expect(itemsText).toEqual(['Item A', 'Item B']);

        // 9. Test of() / child element queries
        const firstItem = PageElement.located(By.css('li')).of(PageElement.located(By.css('ul.items')));
        expect(await actor.answer(firstItem.text())).toBe('Item A');

        // 10. Test states (isEnabled, isSelected)
        const disabledButton = PageElement.located(By.css('button[disabled]'));
        expect(await actor.answer(disabledButton.isEnabled())).toBe(false);
        expect(await actor.answer(buttonByRole.isEnabled())).toBe(true);

        const selectOption = PageElement.located(By.css('option[value="1"]'));
        expect(await actor.answer(selectOption.isSelected())).toBe(true);
        const unselectedOption = PageElement.located(By.css('option[value="2"]'));
        expect(await actor.answer(unselectedOption.isSelected())).toBe(false);
    });

    it('should run the Primary story play function successfully', async () => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const templateNode = doc.querySelector("template");
        if (!templateNode) throw new Error("Template missing");

        const componentFragment = templateNode.content.cloneNode(true) as DocumentFragment;

        const testContainer = document.createElement('div');
        testContainer.appendChild(componentFragment);
        document.body.appendChild(testContainer);

        initCipher(testContainer);

        const canvas = within(testContainer);

        // Mock Storybook step
        const stepMock = async (label: string, cb: Function) => {
            await cb();
        };

        await Primary.play!({
            canvas,
            userEvent,
            canvasElement: testContainer,
            step: stepMock,
        } as any);

        const resultBox = testContainer.querySelector('#result');
        expect(resultBox?.textContent).toBe('Khoor Zruog!');

        document.body.removeChild(testContainer);
    });
});
