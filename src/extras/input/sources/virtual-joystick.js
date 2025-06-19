import { math } from '../../../core/math/math.js';
import { Vec2 } from '../../../core/math/vec2.js';

class VirtualJoystick {
    /**
     * @type {number}
     * @private
     */
    _range = 70;

    /**
     * @type {Vec2}
     * @private
     */
    _position = new Vec2();

    /**
     * @type {Vec2}
     * @private
     */
    _value = new Vec2();

    /**
     * @param {object} options - The options.
     * @param {number} [options.range] - The inner max distance of the joystick.
     */
    constructor({ range } = {}) {
        this._range = range ?? this._range;
    }

    /**
     * The vector value of the joystick, normalized to the range of -1 to 1.
     *
     * @type {Vec2}
     */
    get value() {
        return this._value;
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     * @returns {number[]} - An array containing the base and stick positions.
     */
    down(x, y) {
        this._position.set(x, y);
        this._value.set(0, 0);
        return [x, y, x, y];
    }

    /**
     * @param {number} x - The x position of the stick
     * @param {number} y - The y position of the stick
     * @returns {number[]} - An array containing the base and stick positions.
     */
    move(x, y) {
        this._value.set(x - this._position.x, y - this._position.y);
        if (this._value.length() > this._range) {
            this._value.normalize().mulScalar(this._range);
        }
        this._value.set(
            math.clamp(this._value.x / this._range, -1, 1),
            math.clamp(this._value.y / this._range, -1, 1)
        );
        const { x: bx, y: by } = this._position;
        return [bx, by, bx + this._value.x, by + this._value.y];
    }

    /**
     * Resets the joystick to its initial state.
     *
     * @returns {number[]} - An array containing the base and stick positions, both set to -1.
     */
    up() {
        this._position.set(0, 0);
        this._value.set(0, 0);
        return [-1, -1, -1, -1];
    }
}

export { VirtualJoystick };
