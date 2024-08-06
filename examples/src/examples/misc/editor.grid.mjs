import * as pc from 'playcanvas';

class Grid {
    /**
     * @type {pc.Vec3[]}
     * @private
     */
    _lines = [];

    /**
     * @type {pc.Color}
     * @private
     */
    _color = new pc.Color(1, 1, 1, 0.5);

    /**
     * @type {pc.Vec2}
     * @private
     */
    _halfExtents = new pc.Vec2(4, 4);

    constructor() {
        this._setLines();
    }

    set halfExtents(value) {
        this._halfExtents.copy(value);
        this._setLines();
    }

    get halfExtents() {
        return this._halfExtents;
    }

    set color(value) {
        this._color.copy(value);
    }

    get color() {
        return this._color;
    }

    /**
     * @private
     */
    _setLines() {
        this._lines = [
            new pc.Vec3(-this._halfExtents.x, 0, 0),
            new pc.Vec3(this._halfExtents.x, 0, 0),
            new pc.Vec3(0, 0, -this._halfExtents.y),
            new pc.Vec3(0, 0, this._halfExtents.y)
        ];
        for (let i = -this._halfExtents.x; i <= this._halfExtents.x; i++) {
            if (i === 0) {
                continue;
            }
            this._lines.push(new pc.Vec3(i, 0, -this._halfExtents.y));
            this._lines.push(new pc.Vec3(i, 0, this._halfExtents.y));
        }
        for (let i = -this._halfExtents.y; i <= this._halfExtents.y; i++) {
            if (i === 0) {
                continue;
            }
            this._lines.push(new pc.Vec3(-this._halfExtents.x, 0, i));
            this._lines.push(new pc.Vec3(this._halfExtents.x, 0, i));
        }
    }

    /**
     * @param {pc.AppBase} app - The app.
     */
    draw(app) {
        app.drawLines(this._lines, this._color);
    }
}

export { Grid };
