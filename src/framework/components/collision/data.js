import { Vec3 } from '../../../math/vec3.js';

class CollisionComponentData {
    constructor() {
        this.enabled = true;
        this.type = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.radius = 0.5;
        this.axis = 1;
        this.height = 2;
        this.asset = null;

        // Non-serialized properties
        this.shape = null;
        this.model = null;
        this.initialized = false;
    }
}

export { CollisionComponentData };
