import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';

class ScrollbarComponentData {
    enabled = true;

    orientation = ORIENTATION_HORIZONTAL;

    value = 0;

    /** @type {number} */
    // @ts-ignore
    handleSize;

    /** @type {import('../../../framework/entity').Entity} */
    // @ts-ignore
    handleEntity;
}

export { ScrollbarComponentData };
