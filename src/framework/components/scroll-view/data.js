import { Vec2 } from '../../../core/math/vec2.js';

/**
 * @import { Entity } from '../../../framework/entity.js'
 */

const DEFAULT_DRAG_THRESHOLD = 10;

class ScrollViewComponentData {
    enabled = true;

    /** @type {boolean} */
    horizontal;

    /** @type {boolean} */
    vertical;

    /** @type {number} */
    scrollMode;

    /** @type {number} */
    bounceAmount;

    /** @type {number} */
    friction;

    dragThreshold = DEFAULT_DRAG_THRESHOLD;

    useMouseWheel = true;

    mouseWheelSensitivity = new Vec2(1, 1);

    /** @type {number} */
    horizontalScrollbarVisibility = 0;

    /** @type {number} */
    verticalScrollbarVisibility = 0;

    /** @type {Entity|null} */
    viewportEntity = null;

    /** @type {Entity|null} */
    contentEntity = null;

    /** @type {Entity|null} */
    horizontalScrollbarEntity = null;

    /** @type {Entity|null} */
    verticalScrollbarEntity = null;
}

export { ScrollViewComponentData };
