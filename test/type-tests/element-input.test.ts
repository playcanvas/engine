// Consumer-side type tests for the events ElementInput fires on elements. They carry the browser's
// PointerEvent, WheelEvent or XRInputSourceEvent, and touch events carry the engine's Touch
// objects rather than the DOM Touch and TouchList of the same names.
import type { ElementInputEvent, ElementTouchEvent, Touch as EngineTouch } from '../../build/playcanvas.js';

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type BrowserEvent = PointerEvent | WheelEvent | XRInputSourceEvent | null;

type T1 = Expect<Equal<ElementTouchEvent['touch'], EngineTouch>>;
type T2 = Expect<Equal<ElementTouchEvent['touches'], EngineTouch[]>>;
type T3 = Expect<Equal<ElementTouchEvent['changedTouches'], EngineTouch[]>>;
type T4 = Expect<Equal<ElementInputEvent['event'], BrowserEvent>>;

declare const touchEvent: ElementTouchEvent;

// a touch is tracked across events by its `id`, the pointer id
const id: number = touchEvent.touch.id;
for (const touch of touchEvent.changedTouches) {
    const matches: boolean = touch.id === id;
}
touchEvent.touches.find(touch => touch.id === id);
touchEvent.event?.preventDefault();

// @ts-expect-error The engine's Touch has no `identifier`, which belongs to the DOM Touch.
touchEvent.touch.identifier;
