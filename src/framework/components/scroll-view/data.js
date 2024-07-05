import { Vec2 } from '../../../core/math/vec2.js';

/**
 * @import {Entity} from '../../../framework/entity.js'
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
    horizontalScrollbarVisibility;

    /** @type {number} */
    verticalScrollbarVisibility;

    /** @type {Entity} */
    viewportEntity;

    /** @type {Entity} */
    contentEntity;

    /** @type {Entity} */
    horizontalScrollbarEntity;

    /** @type {Entity} */
    verticalScrollbarEntity;
}

export { ScrollViewComponentData };
