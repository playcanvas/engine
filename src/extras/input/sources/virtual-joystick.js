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
        super();
        this._range = range ?? this._range;
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    down(x, y) {
        this._position.set(x, y);
        this._value.set(0, 0);
        this.fire('position', x, y, x, y);
    }

    /**
     * @param {number} x - The x position of the stick
     * @param {number} y - The y position of the stick
     */
    move(x, y) {
        v.set(x - this._position.x, y - this._position.y);
        if (v.length() > this._range) {
            v.normalize().mulScalar(this._range);
        }
        this._value.set(
            math.clamp(v.x / this._range, -1, 1),
            math.clamp(v.y / this._range, -1, 1)
        );
        const { x: px, y: py } = this._position;
        this.fire('position', px, py, px + v.x, py + v.y);
    }

    up() {
        this._position.set(0, 0);
        this._value.set(0, 0);
        this.fire('position', -1, -1, -1, -1);
    }

    get value() {
        return this._value;
    }
}

export { VirtualJoystick };
