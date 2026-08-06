import { within, expect } from 'storybook/test';

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
    public readonly query: (container: HTMLElement) => HTMLElement | null,
    public readonly queryAll?: (container: HTMLElement) => HTMLElement[]
  ) {}

  static css(selector: string): By {
    return new By(
      `css selector "${selector}"`,
      (container) => container.querySelector(selector),
      (container) => Array.from(container.querySelectorAll(selector))
    );
  }

  static id(id: string): By {
    return new By(
      `id "${id}"`,
      (container) => container.querySelector(`#${id}`),
      (container) => {
        const el = container.querySelector(`#${id}`);
        return el ? [el] : [];
      }
    );
  }

  static tagName(name: string): By {
    return new By(
      `tag name "${name}"`,
      (container) => container.querySelector(name),
      (container) => Array.from(container.querySelectorAll(name))
    );
  }

  static role(roleName: string, options?: QueryOptions): By {
    return new By(
      `role "${roleName}"`,
      (container) => {
        try {
          return within(container).getByRole(roleName, options);
        } catch (e) {
          return null;
        }
      },
      (container) => {
        try {
          return within(container).getAllByRole(roleName, options);
        } catch (e) {
          return [];
        }
      }
    );
  }

  static text(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `text "${textValue}"`,
      (container) => {
        try {
          return within(container).getByText(textValue, options);
        } catch (e) {
          return null;
        }
      },
      (container) => {
        try {
          return within(container).getAllByText(textValue, options);
        } catch (e) {
          return [];
        }
      }
    );
  }

  static labelText(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `label text "${textValue}"`,
      (container) => {
        try {
          return within(container).getByLabelText(textValue, options);
        } catch (e) {
          return null;
        }
      },
      (container) => {
        try {
          return within(container).getAllByLabelText(textValue, options);
        } catch (e) {
          return [];
        }
      }
    );
  }

  static placeholderText(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `placeholder text "${textValue}"`,
      (container) => {
        try {
          return within(container).getByPlaceholderText(textValue, options);
        } catch (e) {
          return null;
        }
      },
      (container) => {
        try {
          return within(container).getAllByPlaceholderText(textValue, options);
        } catch (e) {
          return [];
        }
      }
    );
  }

  static testId(textValue: string | RegExp, options?: QueryOptions): By {
    return new By(
      `test id "${textValue}"`,
      (container) => {
        try {
          return within(container).getByTestId(textValue, options);
        } catch (e) {
          return null;
        }
      },
      (container) => {
        try {
          return within(container).getAllByTestId(textValue, options);
        } catch (e) {
          return [];
        }
      }
    );
  }
}

// --- Target elements (PageElement, PageElements) ---

export class PageElement {
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
    const element = this.locator.query(parentElement);
    if (!element) {
      throw new Error(`Unable to locate element described by ${this.toString()}`);
    }
    return element;
  }

  toString(): string {
    const parentStr = this.parent ? ` of ${this.parent.toString()}` : '';
    return `${this.locator.description}${parentStr}`;
  }
}

export class PageElements {
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
      return this.locator.queryAll(parentElement);
    }
    const single = this.locator.query(parentElement);
    return single ? [single] : [];
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
    const element = this.target.resolve(actor);
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
    const element = this.target.resolve(actor);
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
    const element = this.target.resolve(actor);
    const ability = BrowseWithStorybook.as(actor);
    await ability.userEvent.clear(element);
  }
}

// --- Questions & Assertions ---

export class Text {
  static of(target: PageElement): Question<string> {
    return {
      answeredBy(actor: Actor): string {
        const element = target.resolve(actor);
        return element.textContent ?? '';
      }
    };
  }
}

export class Value {
  static of(target: PageElement): Question<string> {
    return {
      answeredBy(actor: Actor): string {
        const element = target.resolve(actor) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        return element.value ?? '';
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
