import {
    PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP,
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN
} from './constants.js';

/**
 * Calculate assembled primitives for one draw instance from its vertex or index count. Does not
 * inspect index data for primitive-restart markers or remove degenerate primitives.
 *
 * @param {number} type - Primitive topology.
 * @param {number} count - Number of vertices or indices.
 * @returns {number} Number of primitives.
 * @ignore
 */
const getPrimitiveCount = (type, count) => {
    switch (type) {
        case PRIMITIVE_POINTS:
            return count;
        case PRIMITIVE_LINES:
            return Math.floor(count / 2);
        case PRIMITIVE_LINELOOP:
            return count > 1 ? count : 0;
        case PRIMITIVE_LINESTRIP:
            return Math.max(count - 1, 0);
        case PRIMITIVE_TRIANGLES:
            return Math.floor(count / 3);
        case PRIMITIVE_TRISTRIP:
        case PRIMITIVE_TRIFAN:
            return Math.max(count - 2, 0);
        default:
            return 0;
    }
};

export { getPrimitiveCount };
