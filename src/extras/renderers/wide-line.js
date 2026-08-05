import { Color } from '../../core/math/color.js';

/**
 * @import { WideLineRenderer } from './wide-line-renderer.js'
 */

/** Butt line caps stop exactly at the first and last points. */
const LINECAP_BUTT = 0;

/** Square line caps extend past the first and last points by half the line width. */
const LINECAP_SQUARE = 1;

/** Round line caps extend past line and dash ends by half the line width. */
const LINECAP_ROUND = 2;

/** Miter joins extend edges until they intersect. */
const LINEJOIN_MITER = 0;

/** Bevel joins connect segment edges directly. */
const LINEJOIN_BEVEL = 1;

/** Round joins connect segments using a circular edge. */
const LINEJOIN_ROUND = 2;

const validateStyle = (value, min, max, name) => {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
    }
};

const validateNumber = (value, min, name) => {
    if (!Number.isFinite(value) || value < min) {
        throw new RangeError(`${name} must be a finite number greater than or equal to ${min}.`);
    }
};

/**
 * A connected, variable-width line rendered by a {@link WideLineRenderer}. Point data is supplied
 * using packed numeric arrays to avoid allocating an object for each point.
 *
 * A WideLine can belong to at most one WideLineRenderer. Removing it from the renderer leaves the
 * WideLine intact, allowing it to be added to another renderer later.
 *
 * @category Graphics
 */
class WideLine {
    /** @type {Float32Array} @ignore */
    _positions = new Float32Array(0);

    /** @type {Float32Array} @ignore */
    _colors = new Float32Array([1, 1, 1]);

    /** @type {Float32Array} @ignore */
    _widths = new Float32Array([1]);

    /** @type {WideLineRenderer|null} @ignore */
    _renderer = null;

    /** @ignore */
    _rendererIndex = -1;

    /** @ignore */
    _join = LINEJOIN_MITER;

    /** @ignore */
    _cap = LINECAP_BUTT;

    /** @ignore */
    _closed = false;

    /** @ignore */
    _dashLength = 0;

    /** @ignore */
    _gapLength = 0;

    /** @ignore */
    _dashOffset = 0;

    /**
     * Atomically replaces all point data. This is the only operation that can change the number of
     * points. The colors and widths can each be supplied either per point or as a single uniform
     * value.
     *
     * @param {ArrayLike<number>} positions - Packed xyz coordinates. The length must be a multiple
     * of three and contain at least two points.
     * @param {ArrayLike<number>|Color} [colors] - Packed rgb values with one color per point, or a
     * single color used by every point. The alpha component of a {@link Color} is ignored.
     * @param {ArrayLike<number>|number} [widths] - One width per point, or a single width used by
     * every point. Width units are selected by the owning {@link WideLineRenderer} and values must
     * be non-negative.
     * @returns {WideLine} This line.
     */
    set(positions, colors = Color.WHITE, widths = 1) {
        const pointCount = this._validatePositions(positions, 0);
        this._validateColors(colors, pointCount);
        this._validateWidths(widths, pointCount);

        const packedPositions = this._copyPositions(positions, 0, this._positions);
        const packedColors = this._copyColors(colors, pointCount, this._colors);
        const packedWidths = this._copyWidths(widths, pointCount, this._widths);

        this._positions = packedPositions;
        this._colors = packedColors;
        this._widths = packedWidths;
        this._changed();

        return this;
    }

    /**
     * Replaces positions without changing the number of points.
     *
     * @param {ArrayLike<number>} positions - Packed xyz coordinates containing exactly
     * `pointCount * 3` values.
     * @returns {WideLine} This line.
     */
    setPositions(positions) {
        this._positions = this._copyPositions(positions, this.pointCount, this._positions);
        this._changed();
        return this;
    }

    /**
     * Replaces colors without changing the number of points.
     *
     * @param {ArrayLike<number>|Color} colors - Packed rgb values containing exactly
     * `pointCount * 3` values, or a single color used by every point. The alpha component of a
     * {@link Color} is ignored.
     * @returns {WideLine} This line.
     */
    setColors(colors) {
        this._colors = this._copyColors(colors, this.pointCount, this._colors);
        this._changed();
        return this;
    }

    /**
     * Replaces widths without changing the number of points.
     *
     * @param {ArrayLike<number>|number} widths - An array containing exactly `pointCount` values,
     * or a single width used by every point. Width units are selected by the owning
     * {@link WideLineRenderer} and values must be non-negative.
     * @returns {WideLine} This line.
     */
    setWidths(widths) {
        this._widths = this._copyWidths(widths, this.pointCount, this._widths);
        this._changed();
        return this;
    }

    /**
     * The number of points in the line. This is zero until {@link WideLine#set} is called.
     *
     * @type {number}
     */
    get pointCount() {
        return this._positions.length / 3;
    }

    /**
     * The renderer that owns this line, or null when the line is not being rendered.
     *
     * @type {WideLineRenderer|null}
     */
    get renderer() {
        return this._renderer;
    }

    /**
     * The join style. Can be {@link LINEJOIN_MITER}, {@link LINEJOIN_BEVEL} or
     * {@link LINEJOIN_ROUND}. Defaults to {@link LINEJOIN_MITER}.
     *
     * @type {number}
     */
    set join(value) {
        validateStyle(value, LINEJOIN_MITER, LINEJOIN_ROUND, 'join');
        if (this._join !== value) {
            this._join = value;
            this._changed();
        }
    }

    /**
     * Gets the join style.
     *
     * @type {number}
     */
    get join() {
        return this._join;
    }

    /**
     * The cap style. Can be {@link LINECAP_BUTT}, {@link LINECAP_SQUARE} or
     * {@link LINECAP_ROUND}. The style also applies to the ends of visible dashes. Defaults to
     * {@link LINECAP_BUTT}.
     *
     * @type {number}
     */
    set cap(value) {
        validateStyle(value, LINECAP_BUTT, LINECAP_ROUND, 'cap');
        if (this._cap !== value) {
            this._cap = value;
            this._changed();
        }
    }

    /**
     * Gets the cap style.
     *
     * @type {number}
     */
    get cap() {
        return this._cap;
    }

    /**
     * Whether the last point connects back to the first point. Defaults to false.
     *
     * @type {boolean}
     */
    set closed(value) {
        value = !!value;
        if (this._closed !== value) {
            this._closed = value;
            this._changed();
        }
    }

    /**
     * Gets whether the last point connects back to the first point.
     *
     * @type {boolean}
     */
    get closed() {
        return this._closed;
    }

    /**
     * The length of each visible dash in world units. A value of zero makes the line solid.
     * Defaults to zero.
     *
     * @type {number}
     */
    set dashLength(value) {
        validateNumber(value, 0, 'dashLength');
        if (this._dashLength !== value) {
            this._dashLength = value;
            this._changed();
        }
    }

    /**
     * Gets the length of each visible dash in world units.
     *
     * @type {number}
     */
    get dashLength() {
        return this._dashLength;
    }

    /**
     * The length of each gap in world units. A value of zero makes the line solid. Defaults to
     * zero.
     *
     * @type {number}
     */
    set gapLength(value) {
        validateNumber(value, 0, 'gapLength');
        if (this._gapLength !== value) {
            this._gapLength = value;
            this._changed();
        }
    }

    /**
     * Gets the length of each gap in world units.
     *
     * @type {number}
     */
    get gapLength() {
        return this._gapLength;
    }

    /**
     * Offset of the dash pattern in world units. Defaults to zero.
     *
     * @type {number}
     */
    set dashOffset(value) {
        if (!Number.isFinite(value)) {
            throw new RangeError('dashOffset must be a finite number.');
        }
        if (this._dashOffset !== value) {
            this._dashOffset = value;
            this._changed();
        }
    }

    /**
     * Gets the offset of the dash pattern in world units.
     *
     * @type {number}
     */
    get dashOffset() {
        return this._dashOffset;
    }

    /** @ignore */
    _validatePositions(positions, expectedPointCount) {
        const length = positions?.length;
        if (!Number.isInteger(length) || length % 3 !== 0 || length < 6) {
            throw new RangeError('positions must contain packed xyz values for at least two points.');
        }

        const pointCount = length / 3;
        if (expectedPointCount && pointCount !== expectedPointCount) {
            throw new RangeError(`positions must contain exactly ${expectedPointCount * 3} values.`);
        }

        return pointCount;
    }

    /** @ignore */
    _copyPositions(positions, expectedPointCount, target) {
        this._validatePositions(positions, expectedPointCount);

        const result = target.length === positions.length ? target : new Float32Array(positions.length);
        result.set(positions);
        return result;
    }

    /** @ignore */
    _validateColors(colors, pointCount) {
        if (colors instanceof Color) {
            return;
        }

        if (colors?.length !== pointCount * 3) {
            throw new RangeError(`colors must contain exactly ${pointCount * 3} values.`);
        }
    }

    /** @ignore */
    _copyColors(colors, pointCount, target) {
        this._validateColors(colors, pointCount);
        if (colors instanceof Color) {
            const result = target.length === 3 ? target : new Float32Array(3);
            result[0] = colors.r;
            result[1] = colors.g;
            result[2] = colors.b;
            return result;
        }

        const result = target.length === colors.length ? target : new Float32Array(colors.length);
        result.set(colors);
        return result;
    }

    /** @ignore */
    _validateWidths(widths, pointCount) {
        if (typeof widths === 'number') {
            validateNumber(widths, 0, 'width');
            return;
        }

        if (widths?.length !== pointCount) {
            throw new RangeError(`widths must contain exactly ${pointCount} values.`);
        }

        for (let i = 0; i < widths.length; i++) {
            validateNumber(widths[i], 0, `widths[${i}]`);
        }
    }

    /** @ignore */
    _copyWidths(widths, pointCount, target) {
        this._validateWidths(widths, pointCount);
        if (typeof widths === 'number') {
            const result = target.length === 1 ? target : new Float32Array(1);
            result[0] = widths;
            return result;
        }

        const result = target.length === widths.length ? target : new Float32Array(widths.length);
        result.set(widths);
        return result;
    }

    /** @ignore */
    _changed() {
        this._renderer?._lineChanged(this);
    }
}

export {
    LINECAP_BUTT,
    LINECAP_ROUND,
    LINECAP_SQUARE,
    LINEJOIN_BEVEL,
    LINEJOIN_MITER,
    LINEJOIN_ROUND,
    WideLine
};
