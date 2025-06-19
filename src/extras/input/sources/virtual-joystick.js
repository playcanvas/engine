import { math } from '../../../core/math/math.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { EventHandler } from '../../../core/event-handler.js';

const v = new Vec2();

class VirtualJoystick extends EventHandler {
    /**
     * @type {number}
     * @private
     */
    _range = 70;

    /**
     * @type {Vec2}
     * @private
     */
    _base = new Vec2();

    /**
     * @type {Vec2}
     * @private
     */
    _stick = new Vec2();

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
        super();
        this._range = range ?? this._range;
    }

    /**
     * The base position of the joystick, where the stick is anchored.
     *
     * @type {Vec2}
     */
    get base() {
        return this._base;
    }

    /**
     * The position of the stick, which moves based on user input.
     *
     * @type {Vec2}
     */
    get stick() {
        return this._stick;
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
     */
    down(x, y) {
        this._base.set(x, y);
        this._value.set(0, 0);
        this.fire('position', x, y, x, y);
    }

    /**
     * @param {number} x - The x position of the stick
     * @param {number} y - The y position of the stick
     */
    move(x, y) {
        v.set(x - this._base.x, y - this._base.y);
        if (v.length() > this._range) {
            v.normalize().mulScalar(this._range);
        }
        this._value.set(
            math.clamp(v.x / this._range, -1, 1),
            math.clamp(v.y / this._range, -1, 1)
        );
        this._stick.copy(v).add(this._base);
        const { x: bx, y: by } = this._base;
        const { x: sx, y: sy } = this._stick;
        this.fire('position', bx, by, sx, sy);
    }

    up() {
        this._base.set(0, 0);
        this._value.set(0, 0);
        this.fire('position', -1, -1, -1, -1);
    }
}

export { VirtualJoystick };
