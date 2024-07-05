import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

/**
 * @import {Entity} from '../../../framework/entity'
 */

class ScrollbarComponentData {
    enabled = true;

    orientation = ORIENTATION_HORIZONTAL;

    value = 0;

    /** @type {number} */
    handleSize;

    /** @type {Entity} */
    handleEntity;
}

export { ScrollbarComponentData };
