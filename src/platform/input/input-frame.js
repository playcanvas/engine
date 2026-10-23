import { Debug } from '../../core/debug.js';

/**
 * @typedef {object} InputSnapshot
 * @property {number} isn - Input sequence number, incremented by each capture.
 * @property {number} dt - Frame delta time in seconds, as passed to capture().
 * @property {number} ts - Timestamp passed to capture().
 * @property {Record<string, boolean|number|number[]>} input - Deep copy of the input values.
 */

const ZERO = {
    bool: () => false,
    number: () => 0,
    vec2: () => [0, 0],
    vec3: () => [0, 0, 0]
};

/**
 * A per-tick snapshot of game input, intended for networking. The game captures a frame on the
 * client, serializes it with its own code, and steps the same controller on the server with it.
 *
 * Fields are `held` by default and keep their value across captures, which suits state such as
 * a pressed button or a move direction. Fields with `kind: 'delta'` accumulate between captures
 * and are zeroed by each capture, which suits look or scroll amounts. Values are intent only,
 * so they must not be scaled by dt, speed or screen size.
 *
 * @example
 * const frame = new InputFrame({ move: { type: 'vec2' }, look: { type: 'vec2', kind: 'delta' } });
 * frame.input.move[0] = 1;
 * const snapshot = frame.capture(1 / 60, performance.now());
 */
class InputFrame {
    /**
     * @type {Readonly<Record<string, { type: 'bool'|'number'|'vec2'|'vec3', kind?: 'held'|'delta' }>>}
     */
    fields;

    /**
     * @type {Record<string, boolean|number|number[]>}
     */
    input = {};

    /**
     * Number of captures so far.
     *
     * @type {number}
     */
    isn = 0;

    /**
     * @type {string[]}
     * @private
     */
    _deltas = [];

    /**
     * Creates a frame with every field zeroed.
     *
     * @param {Record<string, { type: 'bool'|'number'|'vec2'|'vec3', kind?: 'held'|'delta' }>} fields - Field
     * descriptions keyed by name. Bool fields cannot be `delta`.
     */
    constructor(fields) {
        this.fields = Object.freeze(fields);

        for (const key of Object.keys(fields)) {
            const { type, kind } = fields[key];
            Debug.assert(type !== 'bool' || kind !== 'delta', `InputFrame: bool field '${key}' cannot be a delta.`);
            this.input[key] = ZERO[type]();
            if (kind === 'delta') {
                this._deltas.push(key);
            }
        }
    }

    /**
     * Snapshots the current input and zeroes delta fields. The returned input is a copy that later
     * writes to `input` do not affect.
     *
     * @param {number} dt - Frame delta time in seconds.
     * @param {number} [ts] - Timestamp to stamp on the snapshot.
     * @returns {InputSnapshot} The snapshot for this tick.
     */
    capture(dt, ts = 0) {
        const input = {};
        for (const key of Object.keys(this.input)) {
            const value = this.input[key];
            input[key] = Array.isArray(value) ? value.slice() : value;
        }

        this._clear(this._deltas);

        return { isn: ++this.isn, dt, ts, input };
    }

    /**
     * Zeroes every field. `isn` is not reset, so sequence numbers keep increasing.
     */
    reset() {
        this._clear(Object.keys(this.input));
    }

    /**
     * @param {string[]} keys - Keys of the fields to zero.
     * @private
     */
    _clear(keys) {
        for (const key of keys) {
            const value = this.input[key];
            if (Array.isArray(value)) {
                value.fill(0);
            } else {
                this.input[key] = typeof value === 'boolean' ? false : 0;
            }
        }
    }
}

export { InputFrame };
