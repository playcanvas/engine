import { Debug } from '../../../core/debug.js';

import { Mat4 } from '../../../math/mat4.js';
import { Quat } from '../../../math/quat.js';
import { Vec3 } from '../../../math/vec3.js';

import { ComponentSystem } from '../system.js';

import { CollisionComponent } from './component.js';
import { CollisionComponentData } from './data.js';

import { CollisionBoxSystemImpl } from './shapes/box.js';
import { CollisionSphereSystemImpl } from './shapes/sphere.js';
import { CollisionCapsuleSystemImpl } from './shapes/capsule.js';
import { CollisionCylinderSystemImpl } from './shapes/cylinder.js';
import { CollisionConeSystemImpl } from './shapes/cone.js';
import { CollisionMeshSystemImpl } from './shapes/mesh.js';
import { CollisionCompoundSystemImpl } from './shapes/compound.js';

/** @typedef {import('../../app-base.js').Application} Application */

const mat4 = new Mat4();
const vec3 = new Vec3();
const quat = new Quat();

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @augments ComponentSystem
 */
class CollisionComponentSystem extends ComponentSystem {
    /** @private */
    _id = 'collision';

    /** @private */
    _ComponentType = CollisionComponent;

    /** @private */
    _DataType = CollisionComponentData;

    /** @private */
    _schema = ['enabled'];

    /** @private */
    _implementations = { };

    /** @private */
    _triMeshCache = { };

    /**
     * Creates a new CollisionComponentSystem instance.
     *
     * @param {Application} app - The running {@link Application}.
     */
    constructor(app) {
        super(app);

        this.on('beforeremove', this.onBeforeRemove, this);
    }

    get id() {
        return this._id;
    }

    get ComponentType() {
        return this._ComponentType;
    }

    get DataType() {
        return this._DataType;
    }

    set schema(schema) {
        this._schema = schema;
    }

    get schema() {
        return this._schema;
    }

    get implementations() {
        return this._implementations;
    }

    set triMeshCache(val) {
        this._triMeshCache = val;
    }

    get triMeshCache() {
        return this._triMeshCache;
    }

    initializeComponentData(component, data, properties) {
        const props = [
            'type',
            'halfExtents',
            'radius',
            'axis',
            'height',
            'shape',
            'model',
            'asset',
            'render',
            'renderAsset',
            'enabled'
        ];

        // asset takes priority over model
        // but they are both trying to change the mesh
        // so remove one of them to avoid conflicts
        let idx;
        if (data.hasOwnProperty('asset')) {
            idx = props.indexOf('model');
            if (idx !== -1) {
                props.splice(idx, 1);
            }
            idx = props.indexOf('render');
            if (idx !== -1) {
                props.splice(idx, 1);
            }
        } else if (data.hasOwnProperty('model')) {
            idx = props.indexOf('asset');
            if (idx !== -1) {
                props.splice(idx, 1);
            }
        }

        for (const property of props) {
            if (data.hasOwnProperty(property)) {
                const value = data[property];
                if (Array.isArray(value)) {
                    component[property] = new Vec3(value[0], value[1], value[2]);
                } else {
                    component[property] = value;
                }
            }
        }

        const impl = this._createImplementation(component.type);
        impl.beforeInitialize(component);

        super.initializeComponentData(component, data, this._schema);

        impl.afterInitialize(component);
    }

    // Creates an implementation based on the collision type and caches it
    // in an internal implementations structure, before returning it.
    _createImplementation(type) {
        if (this.implementations[type] === undefined) {
            let impl;
            switch (type) {
                case 'box':
                    impl = new CollisionBoxSystemImpl(this);
                    break;
                case 'sphere':
                    impl = new CollisionSphereSystemImpl(this);
                    break;
                case 'capsule':
                    impl = new CollisionCapsuleSystemImpl(this);
                    break;
                case 'cylinder':
                    impl = new CollisionCylinderSystemImpl(this);
                    break;
                case 'cone':
                    impl = new CollisionConeSystemImpl(this);
                    break;
                case 'mesh':
                    impl = new CollisionMeshSystemImpl(this);
                    break;
                case 'compound':
                    impl = new CollisionCompoundSystemImpl(this);
                    break;
                default:
                    Debug.error(`_createImplementation: Invalid collision system type: ${type}`);
            }
            this.implementations[type] = impl;
        }

        return this.implementations[type];
    }

    // Gets an existing implementation for the specified entity
    _getImplementation(entity) {
        return this.implementations[entity.collision.type];
    }

    cloneComponent(entity, clone) {
        return this._getImplementation(entity).clone(entity, clone);
    }

    onBeforeRemove(entity, component) {
        this.implementations[component.type].beforeRemove(component);
        component.onBeforeRemove();

        this.implementations[component.type].remove(entity);
    }

    updateCompoundChildTransform(entity) {
        // TODO
        // use updateChildTransform once it is exposed in ammo.js

        this._removeCompoundChild(entity.collision.compoundParent, entity.collision.shape);

        if (entity.enabled && entity.collision.enabled) {
            const transform = this._getNodeTransform(entity, entity.collision.compoundParent.entity);
            entity.collision.compoundParent.shape.addChildShape(transform, entity.collision.shape);
            Ammo.destroy(transform);
        }
    }

    _removeCompoundChild(collision, shape) {
        if (collision.shape.removeChildShape) {
            collision.shape.removeChildShape(shape);
        } else {
            const ind = collision._getCompoundChildShapeIndex(shape);
            if (ind !== null) {
                collision.shape.removeChildShapeByIndex(ind);
            }
        }
    }

    onTransformChanged(component, position, rotation, scale) {
        this.implementations[component.type].updateTransform(component, position, rotation, scale);
    }

    // Destroys the previous collision type and creates a new one based on the new type provided
    changeType(component, newType) {
        this.implementations[component.type].beforeRemove(component);
        this.implementations[component.type].remove(component.entity);
        this._createImplementation(newType).reset(component);
    }

    // Recreates rigid bodies or triggers for the specified component
    recreatePhysicalShapes(component) {
        this.implementations[component.type].recreatePhysicalShapes(component);
    }

    _calculateNodeRelativeTransform(node, relative) {
        if (node === relative) {
            const scale = node.getWorldTransform().getScale();
            mat4.setScale(scale.x, scale.y, scale.z);
        } else {
            this._calculateNodeRelativeTransform(node.parent, relative);
            mat4.mul(node.getLocalTransform());
        }
    }

    _getNodeScaling(node) {
        const wtm = node.getWorldTransform();
        const scl = wtm.getScale();
        return new Ammo.btVector3(scl.x, scl.y, scl.z);
    }

    _getNodeTransform(node, relative) {
        let pos, rot;

        if (relative) {
            this._calculateNodeRelativeTransform(node, relative);

            pos = vec3;
            rot = quat;

            mat4.getTranslation(pos);
            rot.setFromMat4(mat4);
        } else {
            pos = node.getPosition();
            rot = node.getRotation();
        }

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        const origin = transform.getOrigin();
        origin.setValue(pos.x, pos.y, pos.z);

        const ammoQuat = new Ammo.btQuaternion();
        ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        transform.setRotation(ammoQuat);
        Ammo.destroy(ammoQuat);
        Ammo.destroy(origin);

        return transform;
    }

    destroy() {
        for (const key in this._triMeshCache) {
            Ammo.destroy(this._triMeshCache[key]);
        }

        this._triMeshCache = null;

        super.destroy();
    }
}

export { CollisionComponentSystem };
