import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';

class CollisionComponentData {
    constructor() {
        this.enabled = true;
        this.type = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.linearOffset = new Vec3();
        this.angularOffset = new Quat();
        this.radius = 0.5;
        this.axis = 1;
        this.height = 2;
        this.asset = null;
        this.renderAsset = null;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
        this.render = null;
        this.initialized = false;
    }
}

export { CollisionComponentData };
