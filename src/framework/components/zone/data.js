import { Vec3 } from '../../../core/math/vec3';

class ZoneComponentData {
    constructor() {
        this.enabled = true;
        this.shape = 'box';
        this.halfExtents = new Vec3(0.5, 0.5, 0.5);
        this.radius = 0.5;
        this.useColliders = true;
    }
}

export { ZoneComponentData };
