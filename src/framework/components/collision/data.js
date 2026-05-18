import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

/**
 * @import { Asset } from '../../../framework/asset/asset.js'
 * @import { Model } from '../../../scene/model.js'
 */

class CollisionComponentData {
    enabled = true;

    type = 'box';

    halfExtents = new Vec3(0.5, 0.5, 0.5);

    linearOffset = new Vec3();

    angularOffset = new Quat();

    radius = 0.5;

    axis = 1;

    height = 2;

    convexHull = false;

    /** @type {Asset|number|null} */
    asset = null;

    /** @type {Asset|number|null} */
    renderAsset = null;

    checkVertexDuplicates = true;

    // Non-serialized properties
    shape = null;

    /** @type {Model|null} */
    model = null;

    render = null;

    initialized = false;
}

export { CollisionComponentData };
