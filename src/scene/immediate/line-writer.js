import { Debug } from '../../core/debug.js';

/**
 * @import { Color } from '../../core/math/color.js'
 */

/**
 * A cursor for writing line vertices straight into the storage of an immediate line batch,
 * avoiding the intermediate array that {@link Immediate#drawLineArrays} style submission needs.
 *
 * Obtained from {@link Immediate#allocateLines}, which hands out a single reused instance. The
 * returned cursor is therefore only valid until the next allocation: use it inside the function
 * that writes the data and never keep hold of it.
 *
 * @ignore
 */
class LineWriter {
    /**
     * Packed xyz positions of the batch being written to.
     *
     * @type {Float32Array|null}
     * @private
     */
    _positions = null;

    /**
     * Packed rgba colors of the batch being written to.
     *
     * @type {Float32Array|null}
     * @private
     */
    _colors = null;

    /**
     * Index of the next vertex to write.
     *
     * @type {number}
     * @private
     */
    _cursor = 0;

    /**
     * One past the last vertex of the allocated region.
     *
     * @type {number}
     * @private
     */
    _end = 0;

    /** @private */
    _r = 1;

    /** @private */
    _g = 1;

    /** @private */
    _b = 1;

    /** @private */
    _a = 1;

    /**
     * Points the cursor at a freshly allocated region.
     *
     * @param {Float32Array} positions - The batch positions.
     * @param {Float32Array} colors - The batch colors.
     * @param {number} first - The first vertex of the region.
     * @param {number} count - The number of vertices in the region.
     * @param {Color} color - The color used by {@link LineWriter#segment}.
     * @ignore
     */
    reset(positions, colors, first, count, color) {
        this._positions = positions;
        this._colors = colors;
        this._cursor = first;
        this._end = first + count;
        this.setColor(color);
    }

    /**
     * Sets the color used by {@link LineWriter#segment}. Can be called between segments. A method
     * rather than an accessor, as the components are unpacked here so they are not read per
     * vertex, and there is nothing meaningful to read back.
     *
     * @param {Color} color - The color to use.
     */
    setColor(color) {
        this._r = color.r;
        this._g = color.g;
        this._b = color.b;
        this._a = color.a;
    }

    /**
     * Whether the whole allocated region has been written. Used to check that a caller filled
     * everything it asked for, since the space is accounted for up front.
     *
     * @type {boolean}
     * @ignore
     */
    get filled() {
        return this._cursor === this._end;
    }

    /**
     * The packed xyz storage being written to. Exposed for callers generating enough vertices
     * that the per-segment call overhead of {@link LineWriter#segment} matters; read it once,
     * write the region, then advance {@link LineWriter#cursor}.
     *
     * @type {Float32Array}
     * @ignore
     */
    get positions() {
        return this._positions;
    }

    /**
     * The packed rgba storage being written to, one color per position.
     *
     * @type {Float32Array}
     * @ignore
     */
    get colors() {
        return this._colors;
    }

    /**
     * The index of the next vertex to write. A caller writing the storage directly must leave
     * this pointing past everything it wrote.
     *
     * @type {number}
     * @ignore
     */
    set cursor(value) {
        this._cursor = value;
    }

    get cursor() {
        return this._cursor;
    }

    /**
     * One past the last vertex of the allocated region.
     *
     * @type {number}
     * @ignore
     */
    get end() {
        return this._end;
    }

    /**
     * Writes one line segment, both ends in the writer's current color.
     *
     * @param {number} x0 - The start x coordinate.
     * @param {number} y0 - The start y coordinate.
     * @param {number} z0 - The start z coordinate.
     * @param {number} x1 - The end x coordinate.
     * @param {number} y1 - The end y coordinate.
     * @param {number} z1 - The end z coordinate.
     */
    segment(x0, y0, z0, x1, y1, z1) {
        Debug.assert(this._cursor + 2 <= this._end,
            'LineWriter.segment wrote past the end of its allocation. The vertex count passed to allocateLines is too small.');

        const positions = this._positions;
        const colors = this._colors;
        const cursor = this._cursor;

        let p = cursor * 3;
        positions[p++] = x0;
        positions[p++] = y0;
        positions[p++] = z0;
        positions[p++] = x1;
        positions[p++] = y1;
        positions[p] = z1;

        const r = this._r, g = this._g, b = this._b, a = this._a;
        let c = cursor * 4;
        colors[c++] = r;
        colors[c++] = g;
        colors[c++] = b;
        colors[c++] = a;
        colors[c++] = r;
        colors[c++] = g;
        colors[c++] = b;
        colors[c] = a;

        this._cursor = cursor + 2;
    }

    /**
     * Writes one vertex with an explicit color. Two consecutive vertices form a segment.
     *
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} r - The red component.
     * @param {number} g - The green component.
     * @param {number} b - The blue component.
     * @param {number} a - The alpha component.
     */
    vertex(x, y, z, r, g, b, a) {
        Debug.assert(this._cursor < this._end,
            'LineWriter.vertex wrote past the end of its allocation. The vertex count passed to allocateLines is too small.');

        const cursor = this._cursor;

        let p = cursor * 3;
        const positions = this._positions;
        positions[p++] = x;
        positions[p++] = y;
        positions[p] = z;

        let c = cursor * 4;
        const colors = this._colors;
        colors[c++] = r;
        colors[c++] = g;
        colors[c++] = b;
        colors[c] = a;

        this._cursor = cursor + 1;
    }
}

export { LineWriter };
