/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Actor,
  BrowseWithStorybook,
  By,
  PageElement,
  PageElements,
  Click,
  Enter,
  Clear,
  Text,
  Value,
  Ensure,
  equals,
  isEqualTo,
  contains,
  isTrue,
  isFalse
} from './screenplay';

describe('Screenplay DSL Unit Tests', () => {
  const createMockEnvironment = () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div id="container">
        <label for="username">User Name</label>
        <input type="text" id="username" placeholder="Enter username" data-testid="user-input" value="" />
        <button id="submit-btn" class="btn">Submit</button>
        <p id="result-text">Hello, World!</p>
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
      </div>
    `;

    // Mock storybook/test userEvent
    const userEvent = {
      click: vi.fn(async (el: HTMLElement) => {
        el.click();
      }),
      type: vi.fn(async (el: HTMLInputElement, value: string) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }),
      clear: vi.fn(async (el: HTMLInputElement) => {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      })
    };

    // Canvas mock
    const canvas = {
      getByRole: (role: string, options?: any) => {
        if (role === 'textbox') {
          return root.querySelector('#username');
        }
        if (role === 'button') {
          return root.querySelector('#submit-btn');
        }
        return null;
      }
    };

    return { root, userEvent, canvas };
  };

  it('Actor can be created with abilities and attempt performables', async () => {
    const { root, userEvent, canvas } = createMockEnvironment();
    const actor = Actor.named('Alice').whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement: root })
    );

    expect(actor.name).toBe('Alice');
    expect(BrowseWithStorybook.as(actor)).toBeInstanceOf(BrowseWithStorybook);
  });

  it('By.css locates element correctly', () => {
    const { root } = createMockEnvironment();
    const byCss = By.css('#result-text');
    const element = byCss.query(root);
    expect(element).not.toBeNull();
    expect(element?.textContent).toBe('Hello, World!');

    const allElements = byCss.queryAll!(root);
    expect(allElements.length).toBe(1);
    expect(allElements[0].textContent).toBe('Hello, World!');
  });

  it('By.id locates element correctly', () => {
    const { root } = createMockEnvironment();
    const byId = By.id('submit-btn');
    const element = byId.query(root);
    expect(element).not.toBeNull();
    expect(element?.id).toBe('submit-btn');
  });

  it('By.tagName locates element correctly', () => {
    const { root } = createMockEnvironment();
    const byTag = By.tagName('p');
    const element = byTag.query(root);
    expect(element).not.toBeNull();
    expect(element?.id).toBe('result-text');
  });

  it('By.role locates elements using queries', () => {
    const { root } = createMockEnvironment();
    const byRole = By.role('button');
    const element = byRole.query(root);
    expect(element).not.toBeNull();
    expect(element?.id).toBe('submit-btn');
  });

  it('PageElement and nested resolving works correctly', () => {
    const { root, userEvent, canvas } = createMockEnvironment();
    const actor = Actor.named('Bob').whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement: root })
    );

    const container = PageElement.located(By.id('container'));
    const input = PageElement.located(By.css('input')).of(container);

    const resolvedInput = input.resolve(actor);
    expect(resolvedInput).not.toBeNull();
    expect(resolvedInput.id).toBe('username');
  });

  it('PageElements queryAll works correctly', () => {
    const { root, userEvent, canvas } = createMockEnvironment();
    const actor = Actor.named('Bob').whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement: root })
    );

    const items = PageElements.located(By.css('.item'));
    const resolvedItems = items.resolve(actor);
    expect(resolvedItems.length).toBe(2);
    expect(resolvedItems[0].textContent).toBe('Item 1');
    expect(resolvedItems[1].textContent).toBe('Item 2');
  });

  it('Interactions (Click, Enter, Clear) perform correct actions', async () => {
    const { root, userEvent, canvas } = createMockEnvironment();
    const actor = Actor.named('Charlie').whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement: root })
    );

    const input = PageElement.located(By.id('username'));
    const button = PageElement.located(By.id('submit-btn'));

    let buttonClicked = false;
    root.querySelector('#submit-btn')?.addEventListener('click', () => {
      buttonClicked = true;
    });

    await actor.attemptsTo(
      Enter.theValue('AliceInWonderland').into(input),
      Click.on(button)
    );

    expect(userEvent.type).toHaveBeenCalledWith(expect.any(HTMLElement), 'AliceInWonderland');
    expect(userEvent.click).toHaveBeenCalledWith(expect.any(HTMLElement));
    expect(buttonClicked).toBe(true);

    await actor.attemptsTo(Clear.theValueOf(input));
    expect(userEvent.clear).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('Questions & Assertions (Text, Value, Ensure) assert correctly', async () => {
    const { root, userEvent, canvas } = createMockEnvironment();
    const actor = Actor.named('Charlie').whoCan(
      BrowseWithStorybook.using({ userEvent, canvas, canvasElement: root })
    );

    const resultText = PageElement.located(By.id('result-text'));
    const input = PageElement.located(By.id('username'));

    // Test text assertion
    await actor.attemptsTo(
      Ensure.that(Text.of(resultText), equals('Hello, World!')),
      Ensure.that(Text.of(resultText), isEqualTo('Hello, World!')),
      Ensure.that(Text.of(resultText), contains('World'))
    );

    // Set input value and test value assertion
    const inputEl = root.querySelector('#username') as HTMLInputElement;
    inputEl.value = 'UserA';

    await actor.attemptsTo(
      Ensure.that(Value.of(input), equals('UserA')),
      Ensure.that(true, isTrue()),
      Ensure.that(false, isFalse())
    );
  });
});
