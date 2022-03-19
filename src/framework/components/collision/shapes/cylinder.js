import { CollisionSystemImpl } from '../implementation.js';

// Cylinder Collision System
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        const component = entity.collision;
        const axis = (component.axis !== undefined) ? component.axis : 1;
        const radius = (component.radius !== undefined) ? component.radius : 0.5;
        const height = (component.height !== undefined) ? component.height : 1;

        let halfExtents = null;
        let shape = null;

        if (typeof Ammo !== 'undefined') {
            switch (axis) {
                case 0:
                    halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
                    shape = new Ammo.btCylinderShapeX(halfExtents);
                    break;
                case 1:
                    halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
                    shape = new Ammo.btCylinderShape(halfExtents);
                    break;
                case 2:
                    halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
                    shape = new Ammo.btCylinderShapeZ(halfExtents);
                    break;
            }
        }

        if (halfExtents)
            Ammo.destroy(halfExtents);

        return shape;
    }
}

export { CollisionCylinderSystemImpl };
