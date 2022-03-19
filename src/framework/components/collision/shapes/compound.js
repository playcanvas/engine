import { CollisionSystemImpl } from '../implementation.js';

// Compound Collision System
class CollisionCompoundSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity) {
        if (typeof Ammo !== 'undefined') {
            return new Ammo.btCompoundShape();
        }
        return undefined;
    }

    _addEachDescendant(entity) {
        if (!entity.collision || entity.rigidbody)
            return;

        entity.collision._compoundParent = this;

        if (entity !== this.entity) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
    }

    _updateEachDescendant(entity) {
        if (!entity.collision)
            return;

        if (entity.collision._compoundParent !== this)
            return;

        entity.collision._compoundParent = null;

        if (entity !== this.entity && !entity.rigidbody) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
    }

    _updateEachDescendantTransform(entity) {
        if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent)
            return;

        this.collision.system.updateCompoundChildTransform(entity);
    }
}

export { CollisionCompoundSystemImpl };
