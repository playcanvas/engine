import { CollisionSystemImpl } from '../implementation.js';

// Box Collision System
class CollisionBoxSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        if (typeof Ammo !== 'undefined') {
            const he = entity.collision.halfExtents;
            const ammoHe = new Ammo.btVector3(he ? he.x : 0.5, he ? he.y : 0.5, he ? he.z : 0.5);
            const shape = new Ammo.btBoxShape(ammoHe);
            Ammo.destroy(ammoHe);
            return shape;
        }
        return undefined;
    }
}

export { CollisionBoxSystemImpl };
