import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';

const tmpVa = new Vec2();

class Joystick {
    /**
     * @type {number}
     * @private
     */
    _scale = 100;

    /**
     * @type {number}
     * @private
     */
    _innerScaleMult = 0.6;

    /**
     * @type {number}
     * @private
     */
    _innerMaxDist = 70;

    /**
     * @type {HTMLDivElement}
     * @private
     */
    _base;

    /**
     * @type {HTMLDivElement}
     * @private
     */
    _stick;

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
     * @param {number} [options.scale] - The scale of the joystick.
     * @param {number} [options.innerScale] - The inner scale of the joystick.
     * @param {number} [options.innerMaxDist] - The inner max distance of the joystick.
     */
    constructor(options = {}) {
        this._scale = options.scale ?? this._scale;
        this._innerScaleMult = options.innerScale ?? this._innerScaleMult;
        this._innerMaxDist = options.innerMaxDist ?? this._innerMaxDist;

        this._base = document.createElement('div');
        this._base.id = 'joystick-base';
        Object.assign(this._base.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._scale}px`,
            height: `${this._scale}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.5)'
        });

        this._stick = document.createElement('div');
        this._stick.id = 'joystick-inner';
        Object.assign(this._stick.style, {
            display: 'none',
            position: 'absolute',
            width: `${this._scale * this._innerScaleMult}px`,
            height: `${this._scale * this._innerScaleMult}px`,
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)'
        });

        document.body.append(this._base, this._stick);
    }

    get dom() {
        return this._base;
    }

    set hidden(value) {
        const display = value ? 'none' : 'block';
        this._base.style.display = display;
        this._stick.style.display = display;
        this._value.set(0, 0);
    }

    get hidden() {
        return this._base.style.display === 'none';
    }

    set position(value) {
        // base position
        this._basePos.copy(value);
        this._base.style.left = `${this._basePos.x - this._scale * 0.5}px`;
        this._base.style.top = `${this._basePos.y - this._scale * 0.5}px`;

        // stick position
        this.stickPosition = value;
    }

    get position() {
        return this._basePos;
    }

    set stickPosition(value) {
        this._stickPos.copy(value);
        tmpVa.sub2(this._stickPos, this._basePos);
        const dist = tmpVa.length();
        if (dist > this._innerMaxDist) {
            tmpVa.normalize().mulScalar(this._innerMaxDist);
            this._stickPos.add2(this._basePos, tmpVa);
        }
        this._stick.style.left = `${this._stickPos.x - this._scale * this._innerScaleMult * 0.5}px`;
        this._stick.style.top = `${this._stickPos.y - this._scale * this._innerScaleMult * 0.5}px`;

        const vx = math.clamp(tmpVa.x / this._innerMaxDist, -1, 1);
        const vy = math.clamp(tmpVa.y / this._innerMaxDist, -1, 1);
        this._value.set(vx, vy);
    }

    get stickPosition() {
        return this._stickPos;
    }

    get value() {
        return this._value;
    }

    destroy() {
        this._base.remove();
        this._stick.remove();
    }
}

export { Joystick };
