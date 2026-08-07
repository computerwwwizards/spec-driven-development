import { expect } from 'storybook/test';

// --- Screenplay Core ---

export interface Ability {
  // Tag interface for abilities
}

export interface Performable {
  performAs(actor: Actor): Promise<void> | void;
}

export interface Question<T> {
  answeredBy(actor: Actor): Promise<T> | T;
}

export function isQuestion<T>(value: any): value is Question<T> {
  return value !== null && typeof value === 'object' && typeof value.answeredBy === 'function';
}

export class Duration {
  private constructor(private readonly milliseconds: number) {}

  static ofMilliseconds(ms: number): Duration {
    return new Duration(ms);
  }

  static ofSeconds(s: number): Duration {
    return new Duration(s * 1000);
  }

  static ofMinutes(m: number): Duration {
    return new Duration(m * 60000);
  }

  toMilliseconds(): number {
    return this.milliseconds;
  }
}

export class Actor {
  private readonly abilities = new Map<any, any>();

  constructor(public readonly name: string) {}

  static named(name: string): Actor {
    return new Actor(name);
  }

  whoCan(...abilities: any[]): this {
    for (const ability of abilities) {
      this.abilities.set(ability.constructor, ability);
    }
    return this;
  }

  abilityTo<T>(abilityClass: new (...args: any[]) => T): T {
    const ability = this.abilities.get(abilityClass) as T;
    if (!ability) {
      throw new Error(`Actor ${this.name} does not have the Ability to ${abilityClass.name}`);
    }
    return ability;
  }

  async attemptsTo(...performables: Performable[]): Promise<void> {
    for (const performable of performables) {
      await performable.performAs(this);
    }
  }

  async answer<T>(question: Question<T> | T): Promise<T> {
    if (isQuestion(question)) {
      return await question.answeredBy(this);
    }
    return question;
  }
}

// --- Ability: BrowseWithStorybook ---

export class BrowseWithStorybook implements Ability {
  constructor(
    public readonly userEvent: any,
    public readonly canvas: any,
    public readonly canvasElement: HTMLElement
  ) {}

  static using(options: { userEvent: any; canvas: any; canvasElement: HTMLElement }): BrowseWithStorybook {
    return new BrowseWithStorybook(options.userEvent, options.canvas, options.canvasElement);
  }

  static as(actor: Actor): BrowseWithStorybook {
    return actor.abilityTo(BrowseWithStorybook);
  }
}

// --- Locators (By) ---

export interface QueryOptions {
  [key: string]: any;
}

export class By {
  constructor(
    public readonly description: string,
    public readonly query: (container: HTMLElement, canvas?: any) => HTMLElement | null,
    public readonly queryAll?: (container: HTMLElement, canvas?: any) => HTMLElement[],
    public readonly find?: (container: HTMLElement, canvas?: any) => Promise<HTMLElement>
  ) {}

  static css(selector: string): By {
    return new By(
      `css selector "${selector}"`,
      (container) => container.querySelector(selector) as HTMLElement | null,
      (container) => Array.from(container.querySelectorAll(selector)) as HTMLElement[]
    );
  }

  static id(id: string): By {
    return new By(
      `id "${id}"`,
      (container) => container.querySelector(`#${id}`) as HTMLElement | null,
      (container) => {
        const el = container.querySelector(`#${id}`) as HTMLElement | null;
        return el ? [el] : [];
      }
    );
  }

  static tagName(name: string): By {
    return new By(
      `tag name "${name}"`,
      (container) => container.querySelector(name) as HTMLElement | null,
      (container) => Array.from(container.querySelectorAll(name)) as HTMLElement[]
    );
  }

  static role(roleName: string, options?: QueryOptions): By {
    return new By(
      `role "${roleName}"`,
      (container, canvas) => {
        if (!canvas && container) {
          const selector = roleName === 'button' ? 'button, [role="button"]' : `[role="${roleName}"]`;
          return container.querySelector(selector);
        }
        try {
          if (canvas && typeof canvas.getByRole === 'function') {
            return canvas.getByRole(roleName, options);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      (container, canvas) => {
        if (!canvas && container) {
          const selector = roleName === 'button' ? 'button, [role="button"]' : `[role="${roleName}"]`;
          return Array.from(container.querySelectorAll(selector));
        }
        try {
          if (canvas && typeof canvas.getAllByRole === 'function') {
            return canvas.getAllByRole(roleName, options);
          }
          return [];
        } catch (e) {
          return [];
        }
      },
      async (container, canvas) => {
        if (canvas && typeof canvas.findByRole === 'function') {
          return await canvas.findByRole(roleName, options);
        }
        throw new Error(`canvas findByRole is not available for role "${roleName}"`);
      }
    );
  }

  static text(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `text "${textValue}"`,
      (container, canvas) => {
        if (!canvas && container) {
          const elements = Array.from(container.querySelectorAll('*'));
          for (const el of elements) {
            const text = el.textContent || '';
            const matches = typeof textValue === 'string' ? text === textValue : textValue.test(text);
            if (matches) return el as HTMLElement;
          }
          return null;
        }
        try {
          if (canvas && typeof canvas.getByText === 'function') {
            return canvas.getByText(textValue, options);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      (container, canvas) => {
        if (!canvas && container) {
          const results: HTMLElement[] = [];
          const elements = Array.from(container.querySelectorAll('*'));
          for (const el of elements) {
            const text = el.textContent || '';
            const matches = typeof textValue === 'string' ? text === textValue : textValue.test(text);
            if (matches) results.push(el as HTMLElement);
          }
          return results;
        }
        try {
          if (canvas && typeof canvas.getAllByText === 'function') {
            return canvas.getAllByText(textValue, options);
          }
          return [];
        } catch (e) {
          return [];
        }
      },
      async (container, canvas) => {
        if (canvas && typeof canvas.findByText === 'function') {
          return await canvas.findByText(textValue, options);
        }
        throw new Error(`canvas findByText is not available for text "${textValue}"`);
      }
    );
  }

  static labelText(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `label text "${textValue}"`,
      (container, canvas) => {
        if (!canvas && container) {
          const labels = Array.from(container.querySelectorAll('label'));
          for (const label of labels) {
            const text = label.textContent || '';
            const matches = typeof textValue === 'string' ? text === textValue : textValue.test(text);
            if (matches) {
              const htmlFor = label.getAttribute('for');
              if (htmlFor) {
                const el = container.querySelector(`#${htmlFor}`);
                if (el) return el as HTMLElement;
              }
            }
          }
          return null;
        }
        try {
          if (canvas && typeof canvas.getByLabelText === 'function') {
            return canvas.getByLabelText(textValue, options);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      (container, canvas) => {
        if (!canvas && container) {
          const results: HTMLElement[] = [];
          const labels = Array.from(container.querySelectorAll('label'));
          for (const label of labels) {
            const text = label.textContent || '';
            const matches = typeof textValue === 'string' ? text === textValue : textValue.test(text);
            if (matches) {
              const htmlFor = label.getAttribute('for');
              if (htmlFor) {
                const el = container.querySelector(`#${htmlFor}`);
                if (el) results.push(el as HTMLElement);
              }
            }
          }
          return results;
        }
        try {
          if (canvas && typeof canvas.getAllByLabelText === 'function') {
            return canvas.getAllByLabelText(textValue, options);
          }
          return [];
        } catch (e) {
          return [];
        }
      },
      async (container, canvas) => {
        if (canvas && typeof canvas.findByLabelText === 'function') {
          return await canvas.findByLabelText(textValue, options);
        }
        throw new Error(`canvas findByLabelText is not available for label text "${textValue}"`);
      }
    );
  }

  static placeholderText(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `placeholder text "${textValue}"`,
      (container, canvas) => {
        if (!canvas && container) {
          const elements = Array.from(container.querySelectorAll('[placeholder]'));
          for (const el of elements) {
            const placeholder = el.getAttribute('placeholder') || '';
            const matches = typeof textValue === 'string' ? placeholder === textValue : textValue.test(placeholder);
            if (matches) return el as HTMLElement;
          }
          return null;
        }
        try {
          if (canvas && typeof canvas.getByPlaceholderText === 'function') {
            return canvas.getByPlaceholderText(textValue, options);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      (container, canvas) => {
        if (!canvas && container) {
          const results: HTMLElement[] = [];
          const elements = Array.from(container.querySelectorAll('[placeholder]'));
          for (const el of elements) {
            const placeholder = el.getAttribute('placeholder') || '';
            const matches = typeof textValue === 'string' ? placeholder === textValue : textValue.test(placeholder);
            if (matches) results.push(el as HTMLElement);
          }
          return results;
        }
        try {
          if (canvas && typeof canvas.getAllByPlaceholderText === 'function') {
            return canvas.getAllByPlaceholderText(textValue, options);
          }
          return [];
        } catch (e) {
          return [];
        }
      },
      async (container, canvas) => {
        if (canvas && typeof canvas.findByPlaceholderText === 'function') {
          return await canvas.findByPlaceholderText(textValue, options);
        }
        throw new Error(`canvas findByPlaceholderText is not available for placeholder text "${textValue}"`);
      }
    );
  }

  static testId(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `test id "${textValue}"`,
      (container, canvas) => {
        if (!canvas && container) {
          const selector = `[data-testid="${textValue}"]`;
          return container.querySelector(selector);
        }
        try {
          if (canvas && typeof canvas.getByTestId === 'function') {
            return canvas.getByTestId(textValue, options);
          }
          return null;
        } catch (e) {
          return null;
        }
      },
      (container, canvas) => {
        if (!canvas && container) {
          const selector = `[data-testid="${textValue}"]`;
          return Array.from(container.querySelectorAll(selector));
        }
        try {
          if (canvas && typeof canvas.getAllByTestId === 'function') {
            return canvas.getAllByTestId(textValue, options);
          }
          return [];
        } catch (e) {
          return [];
        }
      },
      async (container, canvas) => {
        if (canvas && typeof canvas.findByTestId === 'function') {
          return await canvas.findByTestId(textValue, options);
        }
        throw new Error(`canvas findByTestId is not available for test id "${textValue}"`);
      }
    );
  }
}

// --- Target elements (PageElement, PageElements) ---

export class PageElement implements Question<HTMLElement> {
  constructor(
    public readonly locator: By,
    public readonly parent?: PageElement
  ) {}

  static located(locator: By): PageElement {
    return new PageElement(locator);
  }

  of(parent: PageElement): PageElement {
    return new PageElement(this.locator, parent);
  }

  resolve(actor: Actor): HTMLElement {
    const ability = BrowseWithStorybook.as(actor);
    const parentElement = this.parent ? this.parent.resolve(actor) : ability.canvasElement;
    const element = this.locator.query(parentElement, this.parent ? null : ability.canvas);
    if (!element) {
      throw new Error(`Unable to locate element described by ${this.toString()}`);
    }
    return element;
  }

  async resolveAsync(actor: Actor): Promise<HTMLElement> {
    const ability = BrowseWithStorybook.as(actor);
    const parentElement = this.parent ? await this.parent.resolveAsync(actor) : ability.canvasElement;
    if (!this.parent && this.locator.find) {
      try {
        const element = await this.locator.find(parentElement, ability.canvas);
        if (element) return element;
      } catch (e) {
        // Fallback to query
      }
    }
    const element = this.locator.query(parentElement, this.parent ? null : ability.canvas);
    if (!element) {
      throw new Error(`Unable to locate element described by ${this.toString()}`);
    }
    return element;
  }

  async answeredBy(actor: Actor): Promise<HTMLElement> {
    return await this.resolveAsync(actor);
  }

  toString(): string {
    const parentStr = this.parent ? ` of ${this.parent.toString()}` : '';
    return `${this.locator.description}${parentStr}`;
  }
}

export class PageElements implements Question<HTMLElement[]> {
  constructor(
    public readonly locator: By,
    public readonly parent?: PageElement
  ) {}

  static located(locator: By): PageElements {
    return new PageElements(locator);
  }

  of(parent: PageElement): PageElements {
    return new PageElements(this.locator, parent);
  }

  resolve(actor: Actor): HTMLElement[] {
    const ability = BrowseWithStorybook.as(actor);
    const parentElement = this.parent ? this.parent.resolve(actor) : ability.canvasElement;
    if (this.locator.queryAll) {
      return this.locator.queryAll(parentElement, this.parent ? null : ability.canvas);
    }
    const single = this.locator.query(parentElement, this.parent ? null : ability.canvas);
    return single ? [single] : [];
  }

  async resolveAsync(actor: Actor): Promise<HTMLElement[]> {
    const ability = BrowseWithStorybook.as(actor);
    const parentElement = this.parent ? await this.parent.resolveAsync(actor) : ability.canvasElement;
    if (this.locator.queryAll) {
      return this.locator.queryAll(parentElement, this.parent ? null : ability.canvas);
    }
    const single = this.locator.query(parentElement, this.parent ? null : ability.canvas);
    return single ? [single] : [];
  }

  async answeredBy(actor: Actor): Promise<HTMLElement[]> {
    return await this.resolveAsync(actor);
  }

  toString(): string {
    const parentStr = this.parent ? ` of ${this.parent.toString()}` : '';
    return `elements matching ${this.locator.description}${parentStr}`;
  }
}

// --- Interactions (Performables) ---

export class Click implements Performable {
  constructor(private readonly target: PageElement) {}

  static on(target: PageElement): Click {
    return new Click(target);
  }

  async performAs(actor: Actor): Promise<void> {
    const element = await this.target.resolveAsync(actor);
    const ability = BrowseWithStorybook.as(actor);
    await ability.userEvent.click(element);
  }
}

export class Enter implements Performable {
  private constructor(
    private readonly value: string,
    private readonly target?: PageElement
  ) {}

  static theValue(value: string): Enter {
    return new Enter(value);
  }

  into(target: PageElement): Enter {
    return new Enter(this.value, target);
  }

  async performAs(actor: Actor): Promise<void> {
    if (!this.target) {
      throw new Error(`Target element not specified for Enter.theValue('${this.value}')`);
    }
    const element = await this.target.resolveAsync(actor);
    const ability = BrowseWithStorybook.as(actor);
    await ability.userEvent.type(element, this.value);
  }
}

export class Clear implements Performable {
  constructor(private readonly target: PageElement) {}

  static theValueOf(target: PageElement): Clear {
    return new Clear(target);
  }

  async performAs(actor: Actor): Promise<void> {
    const element = await this.target.resolveAsync(actor);
    const ability = BrowseWithStorybook.as(actor);
    await ability.userEvent.clear(element);
  }
}

export class DoubleClick implements Performable {
  constructor(private readonly target: PageElement) {}

  static on(target: PageElement): DoubleClick {
    return new DoubleClick(target);
  }

  async performAs(actor: Actor): Promise<void> {
    const element = await this.target.resolveAsync(actor);
    const ability = BrowseWithStorybook.as(actor);
    if (typeof ability.userEvent.dblClick === 'function') {
      await ability.userEvent.dblClick(element);
    } else {
      element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }
  }
}

export class Hover implements Performable {
  constructor(private readonly target: PageElement) {}

  static over(target: PageElement): Hover {
    return new Hover(target);
  }

  async performAs(actor: Actor): Promise<void> {
    const element = await this.target.resolveAsync(actor);
    const ability = BrowseWithStorybook.as(actor);
    if (typeof ability.userEvent.hover === 'function') {
      await ability.userEvent.hover(element);
    } else {
      element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }
  }
}

export class Press implements Performable {
  private constructor(
    private readonly key: string,
    private readonly target?: PageElement
  ) {}

  static the(key: string): Press {
    return new Press(key);
  }

  in(target: PageElement): Press {
    return new Press(this.key, target);
  }

  async performAs(actor: Actor): Promise<void> {
    const ability = BrowseWithStorybook.as(actor);
    if (this.target) {
      const element = await this.target.resolveAsync(actor);
      if (typeof ability.userEvent.type === 'function') {
        await ability.userEvent.type(element, `{${this.key}}`);
      } else {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: this.key, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: this.key, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: this.key, bubbles: true }));
      }
    } else {
      if (typeof ability.userEvent.keyboard === 'function') {
        await ability.userEvent.keyboard(`{${this.key}}`);
      } else {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: this.key, bubbles: true }));
      }
    }
  }
}

export class Scroll implements Performable {
  constructor(private readonly target: PageElement) {}

  static to(target: PageElement): Scroll {
    return new Scroll(target);
  }

  async performAs(actor: Actor): Promise<void> {
    const element = await this.target.resolveAsync(actor);
    element.scrollIntoView();
  }
}

export class Wait implements Performable {
  private constructor(private readonly duration: Duration) {}

  static for(duration: Duration): Wait {
    return new Wait(duration);
  }

  static upTo(timeout: Duration): { until: <Actual>(actual: Question<Actual> | any, expectation: Expectation<Actual>) => WaitUntil<Actual> } {
    return {
      until: <Actual>(actual: Question<Actual> | any, expectation: Expectation<Actual>) => {
        return new WaitUntil(actual, expectation, timeout);
      }
    };
  }

  static until<Actual>(actual: Question<Actual> | any, expectation: Expectation<Actual>): WaitUntil<Actual> {
    return new WaitUntil(actual, expectation, Duration.ofSeconds(5));
  }

  async performAs(actor: Actor): Promise<void> {
    const ms = this.duration.toMilliseconds();
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class WaitUntil<Actual> implements Performable {
  private pollingInterval = Duration.ofMilliseconds(50);

  constructor(
    private readonly actual: Question<Actual> | any,
    private readonly expectation: Expectation<Actual>,
    private readonly timeout: Duration
  ) {}

  pollingEvery(interval: Duration): this {
    this.pollingInterval = interval;
    return this;
  }

  async performAs(actor: Actor): Promise<void> {
    const timeoutMs = this.timeout.toMilliseconds();
    const pollingMs = this.pollingInterval.toMilliseconds();
    const start = Date.now();

    while (true) {
      try {
        const resolvedActual = isQuestion(this.actual) ? await this.actual.answeredBy(actor) : this.actual;
        this.expectation.assert(resolvedActual);
        return; // Expectation met!
      } catch (e) {
        if (Date.now() - start >= timeoutMs) {
          throw new Error(`Timeout of ${timeoutMs}ms exceeded waiting for condition. Last error: ${e instanceof Error ? e.message : String(e)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, pollingMs));
      }
    }
  }
}

export class Check implements Performable {
  private ifSoPerformables: Performable[] = [];
  private otherwisePerformables: Performable[] = [];

  private constructor(
    private readonly actual: Question<any> | any,
    private readonly expectation?: Expectation<any>
  ) {}

  static whether<T>(actual: Question<T> | T, expectation?: Expectation<T>): Check {
    return new Check(actual, expectation);
  }

  andIfSo(...performables: Performable[]): this {
    this.ifSoPerformables.push(...performables);
    return this;
  }

  otherwise(...performables: Performable[]): this {
    this.otherwisePerformables.push(...performables);
    return this;
  }

  async performAs(actor: Actor): Promise<void> {
    const resolvedActual = isQuestion(this.actual) ? await this.actual.answeredBy(actor) : this.actual;
    let conditionMet = false;

    if (this.expectation) {
      try {
        this.expectation.assert(resolvedActual);
        conditionMet = true;
      } catch (e) {
        conditionMet = false;
      }
    } else {
      conditionMet = !!resolvedActual;
    }

    const performablesToRun = conditionMet ? this.ifSoPerformables : this.otherwisePerformables;
    for (const performable of performablesToRun) {
      await performable.performAs(actor);
    }
  }
}

// --- Questions & Assertions ---

export class Text {
  static of(target: PageElement): Question<string> {
    return {
      async answeredBy(actor: Actor): Promise<string> {
        const element = await target.resolveAsync(actor);
        return element.textContent ?? '';
      }
    };
  }
}

export class Value {
  static of(target: PageElement): Question<string> {
    return {
      async answeredBy(actor: Actor): Promise<string> {
        const element = await target.resolveAsync(actor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        return element.value ?? '';
      }
    };
  }
}

export class Presence {
  static of(target: PageElement): Question<boolean> {
    return {
      async answeredBy(actor: Actor): Promise<boolean> {
        try {
          await target.resolveAsync(actor);
          return true;
        } catch (e) {
          return false;
        }
      }
    };
  }
}

export class Visibility {
  static of(target: PageElement): Question<boolean> {
    return {
      async answeredBy(actor: Actor): Promise<boolean> {
        try {
          const element = await target.resolveAsync(actor);
          if (!element) return false;
          let current: HTMLElement | null = element;
          while (current) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            current = current.parentElement;
          }
          return true;
        } catch (e) {
          return false;
        }
      }
    };
  }
}

export interface Expectation<T> {
  assert(actual: T): void;
}

export class Ensure implements Performable {
  private constructor(
    private readonly actual: Question<any> | any,
    private readonly expectation: Expectation<any>
  ) {}

  static that<T>(actual: Question<T> | T, expectation: Expectation<T>): Ensure {
    return new Ensure(actual, expectation);
  }

  async performAs(actor: Actor): Promise<void> {
    const resolvedActual = isQuestion(this.actual) ? await this.actual.answeredBy(actor) : this.actual;
    this.expectation.assert(resolvedActual);
  }
}

export function equals<T>(expected: T): Expectation<T> {
  return {
    assert(actual: T) {
      expect(actual).toBe(expected);
    }
  };
}

export function isPresent(): Expectation<any> {
  return {
    assert(actual: any) {
      if (actual === null || actual === undefined) {
        throw new Error("Expected element/value to be present, but it was not.");
      }
    }
  };
}

export function not<T>(expectation: Expectation<T>): Expectation<T> {
  return {
    assert(actual: T) {
      try {
        expectation.assert(actual);
      } catch (e) {
        return; // Inner assertion failed, so not() passes!
      }
      throw new Error("Expected expectation to fail, but it passed.");
    }
  };
}

export function isVisible(): Expectation<HTMLElement> {
  return {
    assert(actual: HTMLElement) {
      if (!actual) {
        throw new Error("Expected element to be visible, but it was not found.");
      }
      let current: HTMLElement | null = actual;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') {
          throw new Error("Expected element to be visible, but it was hidden.");
        }
        current = current.parentElement;
      }
    }
  };
}

export function isClickable(): Expectation<HTMLElement> {
  return {
    assert(actual: HTMLElement) {
      if (!actual) {
        throw new Error("Expected element to be clickable, but it was not found.");
      }
      const style = window.getComputedStyle(actual);
      if (style.display === 'none' || style.visibility === 'hidden') {
        throw new Error("Expected element to be clickable, but it was hidden.");
      }
      if ((actual as any).disabled) {
        throw new Error("Expected element to be clickable, but it was disabled.");
      }
    }
  };
}

export function isEnabled(): Expectation<HTMLElement> {
  return {
    assert(actual: HTMLElement) {
      if (!actual) {
        throw new Error("Expected element to be enabled, but it was not found.");
      }
      if ((actual as any).disabled) {
        throw new Error("Expected element to be enabled, but it was disabled.");
      }
    }
  };
}

export function isSelected(): Expectation<HTMLElement> {
  return {
    assert(actual: HTMLElement) {
      if (!actual) {
        throw new Error("Expected element to be selected, but it was not found.");
      }
      if (!(actual as any).selected && !((actual as any).checked)) {
        throw new Error("Expected element to be selected, but it was not.");
      }
    }
  };
}

export function isEqualTo<T>(expected: T): Expectation<T> {
  return equals(expected);
}

export function contains(expected: string): Expectation<string> {
  return {
    assert(actual: string) {
      expect(actual).toContain(expected);
    }
  };
}

export function isTrue(): Expectation<boolean> {
  return {
    assert(actual: boolean) {
      expect(actual).toBe(true);
    }
  };
}

export function isFalse(): Expectation<boolean> {
  return {
    assert(actual: boolean) {
      expect(actual).toBe(false);
    }
  };
}
