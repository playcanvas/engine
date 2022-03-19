import { CollisionSystemImpl } from '../implementation.js';

// Sphere Collision System
class CollisionSphereSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        if (typeof Ammo !== 'undefined') {
            return new Ammo.btSphereShape(entity.collision.radius);
        }
        return undefined;
    }
}

export { CollisionSphereSystemImpl };
