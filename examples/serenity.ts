import {
    PageElement,
    Selector,
    By,
    BrowseTheWeb,
    BrowsingSession,
    Page,
    Locator,
    RootLocator,
    PageElements,
    ByCss,
    ById,
    ByTagName,
    ByRole,
    ByCssContainingText,
    SelectOption,
    SwitchableOrigin,
    Key,
    ModalDialogHandler
} from '@serenity-js/web';
import {
    Question,
    the
} from '@serenity-js/core';
import { CorrelationId } from '@serenity-js/core/lib/model/index.js';
import { within } from 'storybook/test';

export class SelfSelector extends Selector {
    constructor() {
        super();
    }
}

export class StorybookRootLocator extends RootLocator<HTMLElement> {
    constructor(private readonly canvasElementOrFn: HTMLElement | (() => Promise<HTMLElement> | HTMLElement)) {
        super();
    }
    async switchToFrame(element: HTMLElement): Promise<void> {}
    async switchToParentFrame(): Promise<void> {}
    async switchToMainFrame(): Promise<void> {}
    async isPresent(): Promise<boolean> {
        try {
            const el = await this.nativeElement();
            return !!el;
        } catch {
            return false;
        }
    }
    async nativeElement(): Promise<HTMLElement> {
        if (typeof this.canvasElementOrFn === 'function') {
            return await this.canvasElementOrFn();
        }
        return this.canvasElementOrFn;
    }
}

export class StorybookLocator extends Locator<HTMLElement> {
    constructor(
        parent: RootLocator<HTMLElement>,
        selector: Selector,
        public readonly context: { canvas: any; userEvent: any; canvasElement: HTMLElement }
    ) {
        super(parent, selector);
    }

    async nativeElement(): Promise<HTMLElement> {
        const parentElement = await this.parent.nativeElement() as HTMLElement;
        if (!parentElement) {
            throw new Error(`Parent element not found`);
        }
        const resolved = this.resolveSelector(parentElement);
        if (!resolved) {
            throw new Error(`Element not found: ${this.selector.toString()}`);
        }
        return resolved;
    }

    async allNativeElements(): Promise<Array<HTMLElement>> {
        const parentElement = await this.parent.nativeElement() as HTMLElement;
        if (!parentElement) {
            return [];
        }
        return this.resolveAllSelector(parentElement);
    }

    private resolveSelector(parent: HTMLElement): HTMLElement | null {
        const selector = this.selector;
        if (selector instanceof SelfSelector) {
            return parent;
        }
        if (selector instanceof ByCss) {
            return parent.querySelector(selector.value);
        }
        if (selector instanceof ById) {
            return parent.querySelector(`#${selector.value}`);
        }
        if (selector instanceof ByTagName) {
            return parent.querySelector(selector.value);
        }
        if (selector instanceof ByRole) {
            const value = selector.value;
            const options = selector.options || {};
            return within(parent).queryByRole(value as any, options as any) as HTMLElement | null;
        }
        if (selector instanceof ByCssContainingText) {
            const elements = parent.querySelectorAll(selector.value);
            for (const el of Array.from(elements)) {
                if (el.textContent && el.textContent.includes(selector.text)) {
                    return el as HTMLElement;
                }
            }
            return null;
        }
        if ('value' in selector && typeof (selector as any).value === 'string') {
            return parent.querySelector((selector as any).value);
        }
        return null;
    }

    private resolveAllSelector(parent: HTMLElement): Array<HTMLElement> {
        const selector = this.selector;
        if (selector instanceof SelfSelector) {
            return [parent];
        }
        if (selector instanceof ByCss) {
            return Array.from(parent.querySelectorAll(selector.value)) as HTMLElement[];
        }
        if (selector instanceof ById) {
            return Array.from(parent.querySelectorAll(`#${selector.value}`)) as HTMLElement[];
        }
        if (selector instanceof ByTagName) {
            return Array.from(parent.querySelectorAll(selector.value)) as HTMLElement[];
        }
        if (selector instanceof ByRole) {
            const value = selector.value;
            const options = selector.options || {};
            return within(parent).queryAllByRole(value as any, options as any) as HTMLElement[];
        }
        if (selector instanceof ByCssContainingText) {
            const elements = parent.querySelectorAll(selector.value);
            return Array.from(elements).filter(el => el.textContent && el.textContent.includes(selector.text)) as HTMLElement[];
        }
        if ('value' in selector && typeof (selector as any).value === 'string') {
            return Array.from(parent.querySelectorAll((selector as any).value)) as HTMLElement[];
        }
        return [];
    }

    async isPresent(): Promise<boolean> {
        try {
            const parentPresent = await this.parent.isPresent();
            if (!parentPresent) {
                return false;
            }
            const parentElement = await this.parent.nativeElement() as HTMLElement;
            return !!this.resolveSelector(parentElement);
        } catch {
            return false;
        }
    }

    protected nativeSelector(): any {
        return (this.selector as any).value;
    }

    of(parent: RootLocator<HTMLElement>): Locator<HTMLElement> {
        return new StorybookLocator(parent, this.selector, this.context);
    }

    closestTo(child: Locator<HTMLElement>): Locator<HTMLElement> {
        return new StorybookLocator(
            new StorybookRootLocator(async () => {
                const childEl = await child.nativeElement();
                const cssSelector = this.asCssSelector(this.selector).value;
                const closestEl = childEl.closest(cssSelector);
                if (!closestEl) {
                    throw new Error(`No ancestor matches selector: ${cssSelector}`);
                }
                return closestEl as HTMLElement;
            }),
            this.selector,
            this.context
        );
    }

    locate(child: Locator<HTMLElement>): Locator<HTMLElement> {
        return new StorybookLocator(this, child.selector, this.context);
    }

    element(): PageElement<HTMLElement> {
        return new StorybookPageElement(this);
    }

    async allElements(): Promise<Array<PageElement<HTMLElement>>> {
        const elements = await this.allNativeElements();
        return elements.map((element) => {
            const singleLocator = new StorybookLocator(
                new StorybookRootLocator(element),
                new SelfSelector(),
                this.context
            );
            return new StorybookPageElement(singleLocator);
        });
    }
}

export class StorybookPageElement extends PageElement<HTMLElement> {
    constructor(locator: Locator<HTMLElement>) {
        super(locator);
    }

    of(parentElement: PageElement<HTMLElement>): PageElement<HTMLElement> {
        return new StorybookPageElement(this.locator.of(parentElement.locator));
    }

    closestTo(childElement: PageElement<HTMLElement>): PageElement<HTMLElement> {
        return new StorybookPageElement(this.locator.closestTo(childElement.locator));
    }

    async enterValue(value: string | number | Array<string | number>): Promise<void> {
        const element = await this.nativeElement();
        const text = Array.isArray(value) ? value.join('') : String(value);
        element.focus();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.type === 'function') {
            await userEvent.type(element, text);
        } else {
            (element as any).value = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async clearValue(): Promise<void> {
        const element = await this.nativeElement();
        element.focus();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.clear === 'function') {
            await userEvent.clear(element);
        } else {
            (element as any).value = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async click(): Promise<void> {
        const element = await this.nativeElement();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.click === 'function') {
            await userEvent.click(element);
        } else {
            element.click();
        }
    }

    async doubleClick(): Promise<void> {
        const element = await this.nativeElement();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.dblClick === 'function') {
            await userEvent.dblClick(element);
        } else if (userEvent && typeof userEvent.doubleClick === 'function') {
            await userEvent.doubleClick(element);
        } else {
            element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }
    }

    async scrollIntoView(): Promise<void> {
        const element = await this.nativeElement();
        if (typeof element.scrollIntoView === 'function') {
            element.scrollIntoView();
        }
    }

    async hoverOver(): Promise<void> {
        const element = await this.nativeElement();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.hover === 'function') {
            await userEvent.hover(element);
        } else {
            element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        }
    }

    async rightClick(): Promise<void> {
        const element = await this.nativeElement();
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (userEvent && typeof userEvent.pointer === 'function') {
            await userEvent.pointer({ keys: '[MouseRight]', target: element });
        } else {
            element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        }
    }

    async selectOptions(...options: Array<SelectOption>): Promise<void> {
        const element = await this.nativeElement() as HTMLSelectElement;
        const userEvent = (this.locator as StorybookLocator).context.userEvent;
        if (element.tagName === 'SELECT') {
            const values = options.map(opt => opt.value || opt.label);
            if (userEvent && typeof userEvent.selectOptions === 'function') {
                await userEvent.selectOptions(element, values);
            } else {
                for (const option of Array.from(element.options)) {
                    option.selected = values.includes(option.value) || values.includes(option.text);
                }
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    async selectedOptions(): Promise<Array<SelectOption>> {
        const element = await this.nativeElement() as HTMLSelectElement;
        if (element.tagName === 'SELECT') {
            const selected: SelectOption[] = [];
            for (const option of Array.from(element.selectedOptions)) {
                selected.push({
                    value: option.value,
                    label: option.text,
                    disabled: option.disabled,
                });
            }
            return selected;
        }
        return [];
    }

    async dragTo(destination: PageElement<HTMLElement>): Promise<void> {
        const element = await this.nativeElement();
        const destElement = await destination.nativeElement();
        element.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
        destElement.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
        destElement.dispatchEvent(new DragEvent('drop', { bubbles: true }));
        element.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    }

    async attribute(name: string): Promise<string | null> {
        const element = await this.nativeElement();
        return element.getAttribute(name);
    }

    async text(): Promise<string> {
        const element = await this.nativeElement();
        return element.textContent || '';
    }

    async value(): Promise<string> {
        const element = await this.nativeElement();
        return (element as any).value || '';
    }

    async html(): Promise<string> {
        const element = await this.nativeElement();
        return element.outerHTML;
    }

    async switchTo(): Promise<SwitchableOrigin> {
        return {
            switchBack: async () => {}
        };
    }

    async isActive(): Promise<boolean> {
        const element = await this.nativeElement();
        return document.activeElement === element;
    }

    async isClickable(): Promise<boolean> {
        const element = await this.nativeElement();
        return !element.hasAttribute('disabled');
    }

    async isEnabled(): Promise<boolean> {
        const element = await this.nativeElement();
        return !element.hasAttribute('disabled');
    }

    async isSelected(): Promise<boolean> {
        const element = await this.nativeElement();
        return (element as any).selected || (element as any).checked || false;
    }

    async isVisible(): Promise<boolean> {
        const element = await this.nativeElement();
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }
}

class StorybookPageElementsLocator extends Question<Promise<Array<PageElement<HTMLElement>>>> {
    constructor(private readonly locator: Question<Promise<StorybookLocator>>) {
        super(the`page elements located`);
    }

    of(parent: any): StorybookPageElementsLocator {
        return new StorybookPageElementsLocator(
            Question.about(the`${this} of ${parent}`, async (actor) => {
                const locator = await actor.answer(this.locator);
                const parentElement = await actor.answer(parent);
                return locator.of(parentElement.locator) as StorybookLocator;
            })
        );
    }

    async answeredBy(actor: any): Promise<Array<PageElement<HTMLElement>>> {
        const resolved = await actor.answer(this.locator);
        return resolved.allElements();
    }
}

export class StorybookPage extends Page<HTMLElement> {
    private lastScriptResult: any = null;

    constructor(
        session: BrowsingSession<Page<HTMLElement>>,
        public readonly context: { canvas: any; userEvent: any; canvasElement: HTMLElement }
    ) {
        super(
            session,
            new StorybookRootLocator(context.canvasElement),
            new ModalDialogHandler(),
            CorrelationId.create()
        );
    }

    createPageElement(nativeElement: HTMLElement): PageElement<HTMLElement> {
        return new StorybookPageElement(
            new StorybookLocator(
                new StorybookRootLocator(nativeElement),
                new SelfSelector(),
                this.context
            )
        );
    }

    locate(selector: Selector): PageElement<HTMLElement> {
        return new StorybookPageElement(
            new StorybookLocator(
                this.rootLocator,
                selector,
                this.context
            )
        );
    }

    locateAll(selector: Selector): PageElements<HTMLElement> {
        return new PageElements(
            new StorybookPageElementsLocator(
                Question.about(the`page elements locator for ${selector}`, async () => {
                    return new StorybookLocator(
                        this.rootLocator,
                        selector,
                        this.context
                    );
                })
            )
        );
    }

    async navigateTo(destination: string): Promise<void> {}
    async navigateBack(): Promise<void> {}
    async navigateForward(): Promise<void> {}
    async reload(): Promise<void> {}
    async sendKeys(keys: Array<Key | string>): Promise<void> {}

    async executeScript<Result, InnerArguments extends any[]>(
        script: string | ((...parameters: InnerArguments) => Result),
        ...args: InnerArguments
    ): Promise<Result> {
        if (typeof script === 'function') {
            const res = script(...args);
            this.lastScriptResult = res;
            return res;
        }
        const res = eval(script);
        this.lastScriptResult = res;
        return res;
    }

    async executeAsyncScript<Result, Parameters extends any[]>(
        script: string | ((...args: [...parameters: Parameters, callback: (result: Result) => void]) => void),
        ...args: Parameters
    ): Promise<Result> {
        return new Promise<Result>((resolve) => {
            if (typeof script === 'function') {
                script(...args, resolve);
            } else {
                resolve(eval(script));
            }
        });
    }

    lastScriptExecutionResult<R = any>(): R {
        return this.lastScriptResult;
    }

    async takeScreenshot(): Promise<string> {
        return '';
    }

    async cookie(name: string): Promise<any> {
        return null;
    }

    async setCookie(cookieData: any): Promise<void> {}
    async deleteAllCookies(): Promise<void> {}

    async title(): Promise<string> {
        return document.title;
    }

    async url(): Promise<URL> {
        return new URL(window.location.href);
    }

    async name(): Promise<string> {
        return 'Storybook Page';
    }

    async isPresent(): Promise<boolean> {
        return true;
    }

    async viewportSize(): Promise<{ width: number; height: number }> {
        return { width: window.innerWidth, height: window.innerHeight };
    }

    async setViewportSize(size: { width: number; height: number }): Promise<void> {}
    async close(): Promise<void> {}
    async closeOthers(): Promise<void> {}
}

export class StorybookBrowsingSession extends BrowsingSession<StorybookPage> {
    private readonly storybookPage: StorybookPage;

    constructor(context: { canvas: any; userEvent: any; canvasElement: HTMLElement }) {
        super();
        this.storybookPage = new StorybookPage(this, context);
        this.register(this.storybookPage);
    }

    async currentPage(): Promise<StorybookPage> {
        return this.storybookPage;
    }

    async allPages(): Promise<Array<StorybookPage>> {
        return [this.storybookPage];
    }
}

export class BrowseTheWebWithStorybook extends BrowseTheWeb<HTMLElement> {
    static using(canvas: any, userEvent: any, canvasElement: HTMLElement): BrowseTheWebWithStorybook {
        const session = new StorybookBrowsingSession({ canvas, userEvent, canvasElement });
        return new BrowseTheWebWithStorybook(session);
    }
}
