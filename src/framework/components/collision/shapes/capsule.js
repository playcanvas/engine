import { CollisionSystemImpl } from '../implementation.js';

// Capsule Collision System
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        const component = entity.collision;
        const axis = (component.axis !== undefined) ? component.axis : 1;
        const radius = component.radius || 0.5;
        const height = Math.max((component.height || 2) - 2 * radius, 0);

        let shape = null;

        if (typeof Ammo !== 'undefined') {
            switch (axis) {
                case 0:
                    shape = new Ammo.btCapsuleShapeX(radius, height);
                    break;
                case 1:
                    shape = new Ammo.btCapsuleShape(radius, height);
                    break;
                case 2:
                    shape = new Ammo.btCapsuleShapeZ(radius, height);
                    break;
            }
        }

        return shape;
    }
}

export { CollisionCapsuleSystemImpl };
