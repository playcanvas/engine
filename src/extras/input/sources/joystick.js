import { math } from '../../../core/math/math.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { EventHandler } from '../../../core/event-handler.js';

const tmpVa = new Vec2();

class Joystick extends EventHandler {
    /**
     * @event
     */
    static EVENT_POSITIONBASE = 'position:base';

    /**
     * @event
     */
    static EVENT_POSITIONSTICK = 'position:stick';

    /**
     * @event
     */
    static EVENT_RESET = 'reset';

    /**
     * @type {number}
     * @private
     */
    _displacement = 70;

    /**
     * @type {Vec2}
     * @private
     */
    _basePos = new Vec2();

    /**
     * @type {Vec2}
     * @private
     */
    _stickPos = new Vec2();

    /**
     * @type {Vec2}
     * @private
     */
    _value = new Vec2();

    /**
     * @param {object} options - The options.
     * @param {number} [options.displacement] - The inner max distance of the joystick.
     */
    constructor(options = {}) {
        super();
        this._displacement = options.displacement ?? this._displacement;
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    setBase(x, y) {
        // base position
        this._basePos.set(x, y);
        this.fire(Joystick.EVENT_POSITIONBASE, this._basePos.x, this._basePos.y);
    }

    /**
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    setStick(x, y) {
        this._stickPos.set(x, y);
        tmpVa.sub2(this._stickPos, this._basePos);
        const dist = tmpVa.length();
        if (dist > this._displacement) {
            tmpVa.normalize().mulScalar(this._displacement);
            this._stickPos.add2(this._basePos, tmpVa);
        }
        this.fire(Joystick.EVENT_POSITIONSTICK, this._stickPos.x, this._stickPos.y);

        const vx = math.clamp(tmpVa.x / this._displacement, -1, 1);
        const vy = math.clamp(tmpVa.y / this._displacement, -1, 1);
        this._value.set(vx, vy);
    }

    reset() {
        this._value.set(0, 0);
        this.fire(Joystick.EVENT_RESET);
    }

    get value() {
        return this._value;
    }
}

export { Joystick };
