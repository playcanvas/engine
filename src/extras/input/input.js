import { EventHandler } from '../../core/event-handler.js';
import { Pose } from './pose.js';

/** @import { HandleEventCallback } from '../../core/event-handler.js' */

/**
 * Represents an input delta: a fixed-length array of numbers that accumulates input between reads.
 * Sources {@link append} raw values to it as events arrive, and {@link read} returns the total and
 * resets it to zero, so each read yields the change since the previous one. An {@link InputFrame}
 * groups named deltas together.
 *
 * @category Input
 * @alpha
 */
class InputDelta {
    /**
     * @type {number[]}
     * @private
     */
    _value;

    /**
     * @param {number | number[]} arg - The size of the delta or an array of initial values.
     */
    constructor(arg) {
        if (Array.isArray(arg)) {
            this._value = arg.slice();
        } else {
            this._value = new Array(+arg).fill(0);
        }
    }

    /**
     * Adds another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to add.
     * @returns {InputDelta} Self for chaining.
     */
    add(other) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] += other._value[i] || 0;
        }
        return this;
    }

    /**
     * Appends offsets to the current delta values.
     *
     * @param {number[]} offsets - The offsets.
     * @returns {InputDelta} Self for chaining.
     */
    append(offsets) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] += offsets[i] || 0;
        }
        return this;
    }

    /**
     * Copies the values from another InputDelta instance to this one.
     *
     * @param {InputDelta} other - The other InputDelta instance to copy from.
     * @returns {InputDelta} Self for chaining.
     */
    copy(other) {
        for (let i = 0; i < this._value.length; i++) {
            this._value[i] = other._value[i] || 0;
        }
        return this;
    }

    /**
     * The magnitude of the delta, calculated as the square root of the sum of squares
     * of the values.
     *
     * @returns {number} - The magnitude of the delta.
     */
    length() {
        let sum = 0;
        for (const value of this._value) {
            sum += value * value;
        }
        return Math.sqrt(sum);
    }

    /**
     * Returns the current value of the delta and resets it to zero.
     *
     * @returns {number[]} - The current value of the delta.
     */
    read() {
        const value = this._value.slice();
        this._value.fill(0);
        return value;
    }
}

/**
 * Represents an input frame, which contains a map of input deltas. The keys and lengths are fixed
 * by the object passed to the constructor, for example `{ move: [0, 0, 0], rotate: [0, 0, 0] }`,
 * and {@link read} flushes every delta at once. A frame is the unit of exchange in this input
 * system: {@link InputSource}s are frames that fill themselves from a device, and an application
 * combines their values into a frame with the shape an {@link InputController} expects.
 *
 * @category Input
 * @alpha
 *
 * @template {Record<string, number[]>} T - The shape of the input frame.
 */
class InputFrame {
    /**
     * @type {{ [K in keyof T]: InputDelta }}
     */
    deltas = /** @type {{ [K in keyof T]: InputDelta }} */ ({});

    /**
     * @param {T} data - The input frame data, where each key corresponds to an input delta.
     */
    constructor(data) {
        for (const name in data) {
            this.deltas[name] = new InputDelta(data[name]);
        }
    }

    /**
     * Returns the current frame state and resets the deltas to zero.
     *
     * @returns {{ [K in keyof T]: number[] }} - The flushed input frame with current deltas.
     */
    read() {
        const frame = /** @type {{ [K in keyof T]: number[] }} */ ({});
        for (const name in this.deltas) {
            frame[name] = this.deltas[name].read();
        }
        return frame;
    }
}

/**
 * The base class for all input devices. An input source is an {@link InputFrame} that fills its own
 * deltas from DOM events or device polling once {@link attach} is given an element, and stops on
 * {@link detach}. Call {@link InputFrame#read} once per frame to take the accumulated deltas. The
 * built-in sources are {@link KeyboardMouseSource}, {@link GamepadSource},
 * {@link MultiTouchSource}, {@link SingleGestureSource} and {@link DualGestureSource}; subclass
 * this to add another device.
 *
 * @category Input
 * @alpha
 *
 * @template {Record<string, number[]>} T - The shape of the input source.
 * @augments {InputFrame<T>}
 */
class InputSource extends InputFrame {
    /**
     * @type {HTMLElement | null}
     * @protected
     */
    _element = null;

    /**
     * @type {EventHandler}
     * @private
     */
    _events = new EventHandler();

    /**
     * Adds an event listener for the specified event.
     *
     * @param {string} event - The event name to listen for.
     * @param {HandleEventCallback} callback - The callback function to execute when the event is
     * triggered.
     */
    on(event, callback) {
        this._events.on(event, callback);
    }

    /**
     * Removes an event listener for the specified event.
     *
     * @param {string} event - The event name to stop listening for.
     * @param {HandleEventCallback} callback - The callback function to remove.
     */
    off(event, callback) {
        this._events.off(event, callback);
    }

    /**
     * Fires an event with the given name and arguments.
     *
     * @param {string} event - The event name to fire.
     * @param {...any} args - The arguments to pass to the event listeners.
     */
    fire(event, ...args) {
        this._events.fire(event, ...args);
    }

    /**
     * @param {HTMLElement} element - The element.
     */
    attach(element) {
        if (this._element) {
            this.detach();
        }
        this._element = element;
    }

    detach() {
        if (!this._element) {
            return;
        }
        this._element = null;
        this.read();
    }

    destroy() {
        this.detach();
        this._events.off();
    }
}

/**
 * The base class for all input consumers, which are used to process input frames. A consumer
 * implements {@link update}, receiving an {@link InputFrame} and the frame time, and does whatever
 * that input means for it. {@link InputController} is the consumer that turns input into a
 * {@link Pose}.
 *
 * @category Input
 * @alpha
 */
class InputConsumer {
    /**
     * @param {InputFrame} frame - The input frame.
     * @param {number} dt - The delta time.
     */
    update(frame, dt) {
        // discard frame by default
        frame.read();
    }
}

/**
 * The base class for all input controllers. A controller consumes an {@link InputFrame} carrying
 * `move` and `rotate` deltas and produces a {@link Pose}: {@link attach} sets the pose it starts
 * from, {@link update} applies a frame and returns the current pose, and {@link detach} releases
 * it. The application applies the returned pose to an entity. {@link FlyController},
 * {@link OrbitController} and {@link FocusController} implement three ways of doing this.
 *
 * @example
 * controller.attach(pose.look(cameraPosition, target));
 *
 * // each frame, after filling the frame's move and rotate deltas from your sources
 * const result = controller.update(frame, dt);
 * camera.setPosition(result.position);
 * camera.setEulerAngles(result.angles);
 * @category Input
 * @alpha
 */
class InputController extends InputConsumer {
    /**
     * @type {Pose}
     * @protected
     */
    _pose = new Pose();

    /**
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
    }

    detach() {
    }

    /**
     * @param {InputFrame} frame - The input frame.
     * @param {number} dt - The delta time.
     * @returns {Pose} - The controller pose.
     * @override
     */
    update(frame, dt) {
        super.update(frame, dt);

        return this._pose;
    }

    destroy() {
        this.detach();
    }
}

export {
    InputDelta,
    InputFrame,
    InputSource,
    InputConsumer,
    InputController
};
