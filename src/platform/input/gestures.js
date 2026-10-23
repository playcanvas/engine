import { EventHandler } from '../../core/event-handler.js';
import { VirtualJoystick } from './virtual-joystick.js';

/**
 * @typedef {'touch' | 'joystick' | 'touch-touch' | 'touch-joystick' | 'joystick-touch' | 'joystick-joystick'} GestureLayout
 * The control used for each side of the element, written as `left-right`. A single value uses
 * the whole element as the left control.
 */

const DOUBLE_TAP_THRESHOLD = 250; // milliseconds
const DOUBLE_TAP_VARIANCE = 100; // squared pixels

/**
 * @param {string} type - The pointer type.
 * @returns {boolean} True for touch and pen pointers.
 */
const isTouch = type => type === 'touch' || type === 'pen';

/**
 * Touch input for a screen. Attached to an element, it tracks the active touches and reports, for
 * each tick, the pan, pinch and double taps of the touches together with the drag or joystick of
 * each side of the element chosen by {@link Gestures#layout}.
 *
 * Movement is summed per tick in {@link Gestures#left}, {@link Gestures#right}, {@link Gestures#pan},
 * {@link Gestures#pinch} and {@link Gestures#doubleTaps}, and cleared by {@link Gestures#update}.
 * {@link Gestures#count} and the joysticks hold their current state instead. Only touch and pen
 * pointers are tracked.
 *
 * Fires `joystick:position:left` and `joystick:position:right` with `[baseX, baseY, stickX, stickY]`
 * whenever a joystick moves, and with `[-1, -1, -1, -1]` when it is released.
 *
 * @example
 * const gestures = new Gestures(app.graphicsDevice.canvas, { layout: 'joystick-touch' });
 *
 * app.on('update', () => {
 *     const [lookX, lookY] = gestures.left;
 *     const { x, y } = gestures.rightJoystick.value;
 *
 *     gestures.update();
 * });
 * @category Input Devices
 */
class Gestures extends EventHandler {
    /**
     * The drag `[dx, dy]` on the left side summed since the last call to {@link Gestures#update}.
     * Stays zero while the left side is a joystick.
     *
     * @type {number[]}
     */
    left = [0, 0];

    /**
     * The drag `[dx, dy]` on the right side summed since the last call to {@link Gestures#update}.
     * Stays zero while the right side is a joystick.
     *
     * @type {number[]}
     */
    right = [0, 0];

    /**
     * The movement `[dx, dy]` of the midpoint of all active touches summed since the last call to
     * {@link Gestures#update}.
     *
     * @type {number[]}
     */
    pan = [0, 0];

    /**
     * The change in distance between two touches summed since the last call to
     * {@link Gestures#update}. Positive while the touches spread apart.
     *
     * @type {number}
     */
    pinch = 0;

    /**
     * The double taps since the last call to {@link Gestures#update}.
     *
     * @type {number}
     */
    doubleTaps = 0;

    /**
     * The joystick of the left side, when the layout has one.
     *
     * @type {VirtualJoystick}
     */
    leftJoystick = new VirtualJoystick();

    /**
     * The joystick of the right side, when the layout has one.
     *
     * @type {VirtualJoystick}
     */
    rightJoystick = new VirtualJoystick();

    /**
     * @type {Map<number, { x: number, y: number, sx: number, sy: number, left: boolean }>}
     * @private
     */
    _touches = new Map();

    /** @private */
    _layout = 'touch-touch';

    /**
     * @type {HTMLElement|null}
     * @private
     */
    _element = null;

    /** @private */
    _mx = 0;

    /** @private */
    _my = 0;

    /** @private */
    _dist = 0;

    /** @private */
    _tapX = 0;

    /** @private */
    _tapY = 0;

    /** @private */
    _tapTime = -Infinity;

    /**
     * @param {HTMLElement} [element] - The element to attach to.
     * @param {object} [options] - The options.
     * @param {GestureLayout} [options.layout] - The layout. Defaults to `'touch-touch'`.
     */
    constructor(element, options = {}) {
        super();

        this._layout = options.layout ?? this._layout;

        this._onDown = this._onDown.bind(this);
        this._onMove = this._onMove.bind(this);
        this._onEnd = this._onEnd.bind(this);
        this._onMenu = e => e.preventDefault();

        if (element) {
            this.attach(element);
        }
    }

    /**
     * The control used for each side of the element. Changing it releases all active touches.
     *
     * @type {GestureLayout}
     */
    set layout(value) {
        if (this._layout === value) {
            return;
        }
        this._release();
        this._layout = value;
    }

    get layout() {
        return this._layout;
    }

    /**
     * The number of active touches.
     *
     * @type {number}
     */
    get count() {
        return this._touches.size;
    }

    /**
     * Whether a side of the current layout is a joystick.
     *
     * @param {boolean} left - True for the left side.
     * @returns {boolean} True if the side is a joystick.
     * @private
     */
    _isJoystick(left) {
        return left ? this._layout.startsWith('joystick') : this._layout.endsWith('joystick');
    }

    /**
     * Measures the midpoint and distance of the first two touches.
     *
     * @private
     */
    _measure() {
        if (this._touches.size < 2) {
            this._mx = this._my = this._dist = 0;
            return;
        }
        const [a, b] = this._touches.values();
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        this._mx = b.x + dx * 0.5;
        this._my = b.y + dy * 0.5;
        this._dist = Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Releases the joystick of a side and fires its position.
     *
     * @param {boolean} left - True for the left side.
     * @private
     */
    _releaseJoystick(left) {
        const stick = left ? this.leftJoystick : this.rightJoystick;
        this.fire(left ? 'joystick:position:left' : 'joystick:position:right', stick.up());
    }

    /** @private */
    _release() {
        for (const [id, touch] of this._touches) {
            this._element?.releasePointerCapture(id);
            if (this._isJoystick(touch.left)) {
                this._releaseJoystick(touch.left);
            }
        }
        this._touches.clear();
        this._measure();
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onDown(event) {
        const { pointerId, pointerType, clientX: x, clientY: y, screenX: sx, screenY: sy } = event;
        if (!isTouch(pointerType) || this._touches.has(pointerId)) {
            return;
        }
        this._element.setPointerCapture(pointerId);

        const left = !this._layout.includes('-') || x < window.innerWidth * 0.5;
        this._touches.set(pointerId, { x, y, sx, sy, left });
        this._measure();

        const now = Date.now();
        if ((this._tapX - x) ** 2 + (this._tapY - y) ** 2 < DOUBLE_TAP_VARIANCE && now - this._tapTime < DOUBLE_TAP_THRESHOLD) {
            this.doubleTaps++;
        }
        this._tapX = x;
        this._tapY = y;
        this._tapTime = now;

        if (this._isJoystick(left)) {
            const stick = left ? this.leftJoystick : this.rightJoystick;
            this.fire(left ? 'joystick:position:left' : 'joystick:position:right', stick.down(x, y));
        }
    }

    /**
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onMove(event) {
        const { pointerId, target, clientX: x, clientY: y, screenX: sx, screenY: sy } = event;
        const touch = this._touches.get(pointerId);
        if (!touch || target !== this._element) {
            return;
        }
        const dx = sx - touch.sx;
        const dy = sy - touch.sy;
        touch.x = x;
        touch.y = y;
        touch.sx = sx;
        touch.sy = sy;

        if (this._touches.size > 1) {
            const { _mx, _my, _dist } = this;
            this._measure();
            this.pan[0] += this._mx - _mx;
            this.pan[1] += this._my - _my;
            this.pinch += this._dist - _dist;
        } else {
            this.pan[0] += dx;
            this.pan[1] += dy;
        }

        const { left } = touch;
        if (this._isJoystick(left)) {
            const stick = left ? this.leftJoystick : this.rightJoystick;
            this.fire(left ? 'joystick:position:left' : 'joystick:position:right', stick.move(x, y));
        } else {
            const total = left ? this.left : this.right;
            total[0] += dx;
            total[1] += dy;
        }
    }

    /**
     * Ends a touch once, whichever of an up, a cancel or a leave ends it. A touch that leaves
     * while still tracked has ended without an up or a cancel, as both touches of a two-handed
     * pinch do in Safari on Apple Vision Pro, and would otherwise stay down for good.
     *
     * @param {PointerEvent} event - The pointer event.
     * @private
     */
    _onEnd(event) {
        const { pointerId } = event;
        const touch = this._touches.get(pointerId);
        if (!touch) {
            return;
        }
        this._element.releasePointerCapture(pointerId);
        this._touches.delete(pointerId);
        this._measure();

        if (this._isJoystick(touch.left)) {
            this._releaseJoystick(touch.left);
        }
    }

    /**
     * Attaches to an element and starts listening for touches, detaching from any previous one.
     *
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        this.detach();

        this._element = element;
        element.addEventListener('pointerdown', this._onDown);
        element.addEventListener('pointermove', this._onMove);
        element.addEventListener('pointerup', this._onEnd);
        element.addEventListener('pointercancel', this._onEnd);
        element.addEventListener('pointerleave', this._onEnd);
        element.addEventListener('contextmenu', this._onMenu);
    }

    /**
     * Stops listening and releases all active touches.
     */
    detach() {
        const element = this._element;
        if (!element) {
            return;
        }
        this._release();
        element.removeEventListener('pointerdown', this._onDown);
        element.removeEventListener('pointermove', this._onMove);
        element.removeEventListener('pointerup', this._onEnd);
        element.removeEventListener('pointercancel', this._onEnd);
        element.removeEventListener('pointerleave', this._onEnd);
        element.removeEventListener('contextmenu', this._onMenu);
        this._element = null;
    }

    /**
     * Clears the totals summed since the last call. Call it once per tick after reading them.
     */
    update() {
        this.left[0] = this.left[1] = 0;
        this.right[0] = this.right[1] = 0;
        this.pan[0] = this.pan[1] = 0;
        this.pinch = 0;
        this.doubleTaps = 0;
    }

    /**
     * Detaches and removes all event listeners.
     */
    destroy() {
        this.detach();
        this.off();
    }
}

export { Gestures };
