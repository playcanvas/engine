import { Pose } from '../pose.js';

/**
 * @import { GamePads } from '../../../platform/input/game-pads.js'
 * @import { Gestures } from '../../../platform/input/gestures.js'
 * @import { InputFrame, InputSnapshot } from '../../../platform/input/input-frame.js'
 * @import { Keyboard } from '../../../platform/input/keyboard.js'
 * @import { Mouse } from '../../../platform/input/mouse.js'
 */

/**
 * @typedef {object} InputDevices
 * The devices a controller reads in {@link InputController#map}. Any of them may be absent.
 * @property {HTMLElement} [element] - The element the devices are attached to, used to convert
 * pixel deltas to normalized device coordinates.
 * @property {Keyboard} [keyboard] - The keyboard.
 * @property {Mouse} [mouse] - The mouse.
 * @property {Gestures} [gestures] - The touch gestures.
 * @property {GamePads} [gamepads] - The gamepads.
 */

/**
 * The largest snapshot `dt` in seconds that {@link InputController#step} applies.
 *
 * @ignore
 */
export const MAX_STEP_DT = 0.1;

/**
 * Calculate the damp rate.
 *
 * @param {number} damping - The damping.
 * @param {number} dt - The delta time.
 * @returns {number} - The lerp rate.
 * @ignore
 */
export const damp = (damping, dt) => 1 - Math.pow(damping, dt * 1000);

/**
 * Reads a snapshot number, treating missing and non-finite values as 0.
 *
 * @param {*} value - The value.
 * @returns {number} The value, or 0.
 * @ignore
 */
export const num = value => (Number.isFinite(value) ? value : 0);

/**
 * Reads the snapshot `dt` clamped to `[0, MAX_STEP_DT]`.
 *
 * @param {InputSnapshot} snapshot - The snapshot.
 * @returns {number} The clamped delta time.
 * @ignore
 */
export const stepDt = snapshot => Math.min(Math.max(num(snapshot.dt), 0), MAX_STEP_DT);

/**
 * The base class for input controllers. A controller turns device input into a {@link Pose} in
 * two halves, so the same input can drive a pose on a client and on a server:
 *
 * - {@link map} reads devices on the client and writes intent into an {@link InputFrame} built
 * from the controller's static `fields`.
 * - {@link step} applies one captured snapshot of that frame to the authoritative pose. It only
 * depends on the snapshot, the controller {@link state} and its settings, so a client can reset
 * {@link state} to the server's and step pending snapshots again.
 *
 * {@link update} then advances the smoothed display pose toward the authoritative one and returns
 * it. {@link FlyController}, {@link OrbitController} and {@link FocusController} implement this.
 *
 * @example
 * const frame = new InputFrame(OrbitController.fields);
 * controller.attach(pose.look(cameraPosition, target));
 *
 * // each frame
 * controller.map({ element: canvas, mouse, gestures }, frame);
 * controller.step(frame.capture(dt));
 * const result = controller.update(dt);
 * camera.setPosition(result.position);
 * camera.setEulerAngles(result.angles);
 * @category Input
 * @alpha
 */
class InputController {
    /**
     * The description of the {@link InputFrame} fields read by {@link step}.
     *
     * @type {InputFrame['fields']}
     */
    static fields = {};

    /**
     * @type {Pose}
     * @protected
     */
    _pose = new Pose();

    /**
     * Reads devices and writes intent into the frame. Held fields are overwritten and delta
     * fields are accumulated, so call it once per render frame before capturing.
     *
     * @param {InputDevices} devices - The devices to read.
     * @param {InputFrame} frame - The frame built from the controller's static `fields`.
     */
    map(devices, frame) {
    }

    /**
     * Applies a snapshot to the authoritative pose. Missing or non-finite values are read as zero
     * and `dt` is clamped to 0.1 seconds. The `dt` comes from the client, so an authoritative
     * server should validate or replace it, for example with its own tick length or the
     * difference between `ts` values.
     *
     * @param {InputSnapshot} snapshot - The snapshot.
     */
    step(snapshot) {
    }

    /**
     * Sets the authoritative state, a plain object of numbers and arrays.
     *
     * @type {object}
     */
    set state(value) {
    }

    /**
     * Gets a copy of the authoritative state.
     *
     * @type {object}
     */
    get state() {
        return {};
    }

    /**
     * Starts the controller from a pose, such as the camera's current one.
     *
     * @param {Pose} pose - The initial pose of the controller.
     * @param {boolean} [smooth] - Whether to smooth the transition.
     */
    attach(pose, smooth = true) {
    }

    /**
     * Stops the controller. Smoothing controllers settle at the current display pose.
     */
    detach() {
    }

    /**
     * Advances the display pose toward the authoritative pose.
     *
     * @param {number} dt - The delta time in seconds.
     * @returns {Pose} The display pose.
     */
    update(dt) {
        return this._pose;
    }

    /**
     * Detaches the controller and releases its resources.
     */
    destroy() {
        this.detach();
    }
}

export { InputController };
