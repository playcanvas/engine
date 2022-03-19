import { CollisionSystemImpl } from '../implementation.js';

// Cone Collision System
class CollisionConeSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        const component = entity.collision;
        const axis = (component.axis !== undefined) ? component.axis : 1;
        const radius = (component.radius !== undefined) ? component.radius : 0.5;
        const height = (component.height !== undefined) ? component.height : 1;

        let shape = null;

        if (typeof Ammo !== 'undefined') {
            switch (axis) {
                case 0:
                    shape = new Ammo.btConeShapeX(radius, height);
                    break;
                case 1:
                    shape = new Ammo.btConeShape(radius, height);
                    break;
                case 2:
                    shape = new Ammo.btConeShapeZ(radius, height);
                    break;
            }
        }

        return shape;
    }
}

export { CollisionConeSystemImpl };
