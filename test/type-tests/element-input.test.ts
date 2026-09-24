// Consumer-side type tests for the events ElementInput fires on elements. They carry the browser's
// own event and Touch objects, so they must use the DOM types rather than the engine's TouchEvent,
// Touch and MouseEvent classes of the same names.
import type { ElementInputEvent, ElementTouchEvent } from '../../build/playcanvas.js';

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type BrowserEvent = MouseEvent | TouchEvent | XRInputSourceEvent | null;

type T1 = Expect<Equal<ElementTouchEvent['touch'], Touch>>;
type T2 = Expect<Equal<ElementTouchEvent['touches'], TouchList>>;
type T3 = Expect<Equal<ElementTouchEvent['changedTouches'], TouchList>>;
type T4 = Expect<Equal<ElementInputEvent['event'], BrowserEvent>>;

declare const touchEvent: ElementTouchEvent;

// a touch is tracked across events by the browser's `identifier`
const id: number = touchEvent.touch.identifier;
for (const touch of touchEvent.changedTouches) {
    const matches: boolean = touch.identifier === id;
}
touchEvent.event?.preventDefault();

// @ts-expect-error The browser Touch has no `id`, which belongs to the engine's Touch.
touchEvent.touch.id;
// @ts-expect-error A TouchList is not an array.
touchEvent.touches.find(() => true);
