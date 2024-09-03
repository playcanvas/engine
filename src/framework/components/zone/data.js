import { Vec3 } from '../../../core/math/vec3.js';

class ZoneComponentData {
    constructor() {
        this.enabled = true;
        this.type = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.radius = 0.5;
        this.useColliders = false;
    }
}

export { ZoneComponentData };
