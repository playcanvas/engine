import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';

import { isTouchPointer, TouchEvent } from './touch-event.js';

/**
 * @import { Mouse } from './mouse.js'
 */

/**
 * Manages touch input by handling and dispatching touch events. Extends {@link EventHandler}
 * to fire `touchstart`, `touchend`, `touchmove`, and `touchcancel` events (see {@link TouchEvent}).
 *
 * Detects and processes touch interactions with the attached DOM element, allowing applications
 * to respond to common touch gestures. The TouchDevice instance must be attached to a DOM element
 * before it can detect touch events.
 *
 * Events are driven by the touch and pen pointer events of the element, though pens are left to
 * {@link Mouse} on platforms without touch support. Each pointer that goes down, moves, lifts or
 * is cancelled fires one event, whose {@link TouchEvent#changedTouches} holds that pointer's touch. A touch keeps the target it started on, and its coordinates stay
 * relative to that target, as with browser touch events. A touch that leaves the element without
 * lifting or being cancelled ends with `touchend`. The element's `touch-action` style is `none`
 * while attached so the browser does not scroll or zoom it.
 *
 * Your application's TouchDevice instance is managed and accessible via {@link AppBase#touch}.
 *
 * @category Input Devices
 */
class TouchDevice extends EventHandler {
    /**
     * Fired when a touch starts. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchstart', (e) => {
     *     console.log(`Touch started at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHSTART = 'touchstart';

    /**
     * Fired when a touch ends. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchend', (e) => {
     *     console.log(`Touch ended at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHEND = 'touchend';

    /**
     * Fired when a touch moves. The handler is passed a {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchmove', (e) => {
     *     console.log(`Touch moved to position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHMOVE = 'touchmove';

    /**
     * Fired when a touch is interrupted in some way. The exact reasons for canceling a touch can
     * vary from device to device. For example, a modal alert pops up during the interaction; the
     * touch point leaves the document area, or there are more touch points than the device
     * supports, in which case the earliest touch point is canceled. The handler is passed a
     * {@link TouchEvent}.
     *
     * @event
     * @example
     * app.touch.on('touchcancel', (e) => {
     *     console.log(`Touch canceled at position: ${e.x}, ${e.y}`);
     * });
     */
    static EVENT_TOUCHCANCEL = 'touchcancel';

    /**
     * @type {Element|null}
     * @private
     */
    _element = null;

    /**
     * The start target and latest pointer event of each active touch by pointer id, in the order
     * the touches started.
     *
     * @type {Map<number, { target: Element, event: globalThis.PointerEvent }>}
     * @ignore
     */
    _touches = new Map();

    /**
     * The `touch-action` style of the element before it was attached, restored on detach.
     *
     * @private
     */
    _touchAction = '';

    /**
     * @type {(e: globalThis.PointerEvent) => void}
     * @private
     */
    _startHandler;

    /**
     * @type {(e: globalThis.PointerEvent) => void}
     * @private
     */
    _endHandler;

    /**
     * @type {(e: globalThis.PointerEvent) => void}
     * @private
     */
    _moveHandler;

    /**
     * @type {(e: globalThis.PointerEvent) => void}
     * @private
     */
    _cancelHandler;

    /**
     * Create a new touch device and attach it to an element. Attach it to the canvas: attaching it
     * to `document.body` or `document.documentElement` sets `touch-action: none` on the whole page,
     * which stops the page from scrolling and zooming.
     *
     * @param {Element} element - The element to attach listen for events on.
     */
    constructor(element) {
        super();

        this._startHandler = this._handleTouchStart.bind(this);
        this._endHandler = this._handleTouchEnd.bind(this);
        this._moveHandler = this._handleTouchMove.bind(this);
        this._cancelHandler = this._handleTouchCancel.bind(this);

        this.attach(element);
    }

    /**
     * Attach a device to an element in the DOM. If the device is already attached to an element
     * this method will detach it first. The element's `touch-action` style is set to `none` until
     * it is detached, so attach to the canvas: attaching to `document.body` or
     * `document.documentElement` stops the whole page from scrolling and zooming.
     *
     * @param {Element} element - The element to attach to.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }

        Debug.call(() => {
            if (element === document.body || element === document.documentElement) {
                Debug.warnOnce('TouchDevice attached to the document sets touch-action: none on the whole page, which stops it from scrolling and zooming. Attach it to the canvas instead.');
            }
        });

        this._element = element;

        // pointer events cannot prevent default scrolling and zooming, unlike touch events
        const style = /** @type {HTMLElement} */ (element).style;
        if (style) {
            this._touchAction = style.touchAction;
            style.touchAction = 'none';
        }

        element.addEventListener('pointerdown', this._startHandler, false);
        element.addEventListener('pointerup', this._endHandler, false);
        element.addEventListener('pointermove', this._moveHandler, false);
        element.addEventListener('pointercancel', this._cancelHandler, false);
        element.addEventListener('pointerleave', this._endHandler, false);
    }

    /**
     * Detach a device from the element it is attached to and restore the element's `touch-action`
     * style. Active touches are forgotten without firing events.
     */
    detach() {
        const element = this._element;
        if (element) {
            element.removeEventListener('pointerdown', this._startHandler, false);
            element.removeEventListener('pointerup', this._endHandler, false);
            element.removeEventListener('pointermove', this._moveHandler, false);
            element.removeEventListener('pointercancel', this._cancelHandler, false);
            element.removeEventListener('pointerleave', this._endHandler, false);
            const style = /** @type {HTMLElement} */ (element).style;
            if (style) {
                style.touchAction = this._touchAction;
            }
        }
        this._touches.clear();
        this._element = null;
    }

    _handleTouchStart(e) {
        const { pointerId } = e;
        if (!isTouchPointer(e) || this._touches.has(pointerId)) {
            return;
        }

        // no explicit capture: the browser implicitly captures a touch to its start target, and
        // capturing here would steal it from that target's own listeners
        const touch = { target: e.target, event: e };
        this._touches.set(pointerId, touch);
        this.fire('touchstart', new TouchEvent(this, e, touch.target));
    }

    // a leave without an up or a cancel ends the touch too, as both touches of a two-handed pinch
    // do in Safari on Apple Vision Pro
    _handleTouchEnd(e) {
        this._end('touchend', e);
    }

    _handleTouchMove(e) {
        const touch = this._touches.get(e.pointerId);
        if (!touch) {
            return;
        }
        touch.event = e;
        this.fire('touchmove', new TouchEvent(this, e, touch.target));
    }

    _handleTouchCancel(e) {
        this._end('touchcancel', e);
    }

    /**
     * Ends a tracked touch once, whichever event ends it, and fires the event without it in the
     * active touches.
     *
     * @param {string} name - The event name.
     * @param {globalThis.PointerEvent} e - The pointer event.
     * @private
     */
    _end(name, e) {
        const touch = this._touches.get(e.pointerId);

        // a mouse may share a pointer id with a touch
        if (!touch || !isTouchPointer(e)) {
            return;
        }
        this._touches.delete(e.pointerId);
        this.fire(name, new TouchEvent(this, e, touch.target));
    }
}

export { TouchDevice };
