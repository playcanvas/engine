import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Model } from '../../../scene/model.js';
import { ComponentSystem } from '../system.js';
import { CollisionComponent } from './component.js';
import { Trigger } from './trigger.js';

/**
 * @import { AppBase } from '../../app-base.js'
 */

const mat4 = new Mat4();
const p1 = new Vec3();
const p2 = new Vec3();
const quat = new Quat();
const tempGraphNode = new GraphNode();

// Note that `shape` is deliberately absent from this list - it is runtime
// state created and owned by the type implementation, not component data
const _properties = [
    'halfExtents',
    'radius',
    'axis',
    'height',
    'convexHull',
    'model',
    'asset',
    'render',
    'renderAsset',
    'linearOffset',
    'angularOffset',
    'checkVertexDuplicates'
];

// Collision system implementations
class CollisionSystemImpl {
    constructor(system) {
        this.system = system;
    }

    // Called before the call to system.super.initializeComponentData is made
    beforeInitialize(component) {
        component._shape = null;

        const model = new Model();
        model.graph = new GraphNode();
        component._model = model;
    }

    // Called after the call to system.super.initializeComponentData is made
    afterInitialize(component) {
        this.recreatePhysicalShapes(component);
        component._initialized = true;
    }

    // Called when a collision component changes type in order to recreate debug and physical shapes
    reset(component) {
        this.beforeInitialize(component);
        this.afterInitialize(component);
    }

    // Re-creates rigid bodies / triggers
    recreatePhysicalShapes(component) {
        const entity = component.entity;

        if (typeof Ammo !== 'undefined') {
            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }

            if (component._shape) {
                if (component._compoundParent) {
                    if (component !== component._compoundParent) {
                        this.system._removeCompoundChild(component._compoundParent, component._shape);
                    }

                    if (component._compoundParent.entity.rigidbody) {
                        component._compoundParent.entity.rigidbody.activate();
                    }
                }

                this.destroyShape(component);
            }

            component._shape = this.createPhysicalShape(entity, component);

            const firstCompoundChild = !component._compoundParent;

            if (component._type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
                component._compoundParent = component;

                entity.forEach(this._addEachDescendant, component);
            } else if (component._type !== 'compound') {
                if (!component.rigidbody) {
                    component._compoundParent = null;
                    let parent = entity.parent;
                    while (parent) {
                        if (parent.collision && parent.collision.type === 'compound') {
                            component._compoundParent = parent.collision;
                            break;
                        }
                        parent = parent.parent;
                    }
                }
            }

            if (component._compoundParent) {
                if (component !== component._compoundParent) {
                    if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
                        this.system.recreatePhysicalShapes(component._compoundParent);
                    } else {
                        this.system.updateCompoundChildTransform(entity, true);

                        if (component._compoundParent.entity.rigidbody) {
                            component._compoundParent.entity.rigidbody.activate();
                        }
                    }
                }
            }

            if (entity.rigidbody) {
                this._recreateBody(entity);
            } else if (!component._compoundParent) {
                this._recreateTrigger(entity, component);
            }
        }
    }

    // Re-creates the entity's rigid body after the collision shape changed
    _recreateBody(entity) {
        entity.rigidbody.disableSimulation();
        entity.rigidbody.createBody();

        if (entity.enabled && entity.rigidbody.enabled) {
            entity.rigidbody.enableSimulation();
        }
    }

    // Creates the entity's trigger, or re-initializes an existing one
    _recreateTrigger(entity, component) {
        if (!entity.trigger) {
            entity.trigger = new Trigger(this.system.app, component);
        } else {
            entity.trigger.initialize();
        }
    }

    // Creates a physical shape for the collision. This consists
    // of the actual shape that will be used for the rigid bodies / triggers of
    // the collision.
    createPhysicalShape(entity, component) {
        return undefined;
    }

    updateTransform(component, position, rotation, scale) {
        if (component.entity.trigger) {
            component.entity.trigger.updateTransform();
        }
    }

    destroyShape(component) {
        if (component._shape) {
            Ammo.destroy(component._shape);
            component._shape = null;
        }
    }

    beforeRemove(entity, component) {
        if (component._shape) {
            if (component._compoundParent && !component._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(component._compoundParent, component._shape);

                if (component._compoundParent.entity.rigidbody) {
                    component._compoundParent.entity.rigidbody.activate();
                }
            }

            component._compoundParent = null;

            this.destroyShape(component);
        }
    }
}

// Box Collision System
class CollisionBoxSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        if (typeof Ammo !== 'undefined') {
            const he = component.halfExtents;
            const ammoHe = new Ammo.btVector3(he.x, he.y, he.z);
            const shape = new Ammo.btBoxShape(ammoHe);
            Ammo.destroy(ammoHe);
            return shape;
        }
        return undefined;
    }
}

// Sphere Collision System
class CollisionSphereSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        if (typeof Ammo !== 'undefined') {
            return new Ammo.btSphereShape(component.radius);
        }
        return undefined;
    }
}

// Capsule Collision System
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        const axis = component.axis;
        const radius = component.radius;
        const height = Math.max(component.height - 2 * radius, 0);

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

// Cylinder Collision System
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        const axis = component.axis;
        const radius = component.radius;
        const height = component.height;

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

        if (halfExtents) {
            Ammo.destroy(halfExtents);
        }

        return shape;
    }
}

// Cone Collision System
class CollisionConeSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        const axis = component.axis;
        const radius = component.radius;
        const height = component.height;

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

// Mesh Collision System
class CollisionMeshSystemImpl extends CollisionSystemImpl {
    // override for the mesh implementation because the asset model needs
    // special handling
    beforeInitialize(component) {}

    createAmmoHull(mesh, node, shape, scale) {
        const hull = new Ammo.btConvexHullShape();

        const point = new Ammo.btVector3();

        const positions = [];
        mesh.getPositions(positions);

        for (let i = 0; i < positions.length; i += 3) {
            point.setValue(positions[i] * scale.x, positions[i + 1] * scale.y, positions[i + 2] * scale.z);

            // No need to calculate the aabb here. We'll do it after all points are added.
            hull.addPoint(point, false);
        }

        Ammo.destroy(point);

        hull.recalcLocalAabb();
        hull.setMargin(0.01);   // Note: default margin is 0.04

        const transform = this.system._getNodeTransform(node);
        shape.addChildShape(transform, hull);
        Ammo.destroy(transform);
    }

    createAmmoMesh(mesh, node, shape, scale, checkDupes = true) {
        const system = this.system;
        let triMesh;

        if (system._triMeshCache[mesh.id]) {
            triMesh = system._triMeshCache[mesh.id];
        } else {
            const vb = mesh.vertexBuffer;

            const format = vb.getFormat();
            let stride, positions;
            for (let i = 0; i < format.elements.length; i++) {
                const element = format.elements[i];
                if (element.name === SEMANTIC_POSITION) {
                    positions = new Float32Array(vb.lock(), element.offset);
                    stride = element.stride / 4;
                    break;
                }
            }

            const indices = [];
            mesh.getIndices(indices);
            const numTriangles = mesh.primitive[0].count / 3;

            const v1 = new Ammo.btVector3();
            let i1, i2, i3;

            const base = mesh.primitive[0].base;
            triMesh = new Ammo.btTriangleMesh();
            system._triMeshCache[mesh.id] = triMesh;

            const vertexCache = new Map();
            Debug.assert(typeof triMesh.getIndexedMeshArray === 'function', 'Ammo.js version is too old, please update to a newer Ammo.');
            const indexedArray = triMesh.getIndexedMeshArray();
            indexedArray.at(0).m_numTriangles = numTriangles;

            const sx = scale ? scale.x : 1;
            const sy = scale ? scale.y : 1;
            const sz = scale ? scale.z : 1;

            const addVertex = (index) => {
                const x = positions[index * stride] * sx;
                const y = positions[index * stride + 1] * sy;
                const z = positions[index * stride + 2] * sz;

                let idx;
                if (checkDupes) {
                    const str = `${x}:${y}:${z}`;

                    idx = vertexCache.get(str);
                    if (idx !== undefined) {
                        return idx;
                    }

                    v1.setValue(x, y, z);
                    idx = triMesh.findOrAddVertex(v1, false);
                    vertexCache.set(str, idx);
                } else {
                    v1.setValue(x, y, z);
                    idx = triMesh.findOrAddVertex(v1, false);
                }

                return idx;
            };

            for (let i = 0; i < numTriangles; i++) {
                i1 = addVertex(indices[base + i * 3]);
                i2 = addVertex(indices[base + i * 3 + 1]);
                i3 = addVertex(indices[base + i * 3 + 2]);

                triMesh.addIndex(i1);
                triMesh.addIndex(i2);
                triMesh.addIndex(i3);
            }

            Ammo.destroy(v1);
        }

        const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, true /* useQuantizedAabbCompression */);

        if (!scale) {
            const scaling = system._getNodeScaling(node);
            triMeshShape.setLocalScaling(scaling);
            Ammo.destroy(scaling);
        }

        const transform = system._getNodeTransform(node);
        shape.addChildShape(transform, triMeshShape);
        Ammo.destroy(transform);
    }

    createPhysicalShape(entity, component) {
        if (typeof Ammo === 'undefined') return undefined;

        if (component._model || component._render) {

            const shape = new Ammo.btCompoundShape();
            const entityTransform = entity.getWorldTransform();
            const scale = entityTransform.getScale();

            if (component._render) {
                const meshes = component._render.meshes;
                for (let i = 0; i < meshes.length; i++) {
                    if (component._convexHull) {
                        this.createAmmoHull(meshes[i], tempGraphNode, shape, scale);
                    } else {
                        this.createAmmoMesh(meshes[i], tempGraphNode, shape, scale, component._checkVertexDuplicates);
                    }
                }
            } else if (component._model) {
                const meshInstances = component._model.meshInstances;
                for (let i = 0; i < meshInstances.length; i++) {
                    this.createAmmoMesh(meshInstances[i].mesh, meshInstances[i].node, shape, null, component._checkVertexDuplicates);
                }
                const vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
                shape.setLocalScaling(vec);
                Ammo.destroy(vec);
            }

            return shape;
        }

        return undefined;
    }

    recreatePhysicalShapes(component) {
        if (component._renderAsset || component._asset) {
            if (component.enabled && component.entity.enabled) {
                this.loadAsset(
                    component,
                    component._renderAsset || component._asset,
                    component._renderAsset ? 'render' : 'model'
                );
                return;
            }
        }

        this.doRecreatePhysicalShape(component);
    }

    loadAsset(component, id, property) {
        const assets = this.system.app.assets;
        // write the loaded resource to the private field - the public setter
        // would trigger a second shape rebuild via doRecreatePhysicalShape
        const privateProperty = `_${property}`;
        const previousPropertyValue = component[privateProperty];

        const onAssetFullyReady = (asset) => {
            if (component[privateProperty] !== previousPropertyValue) {
                // the asset has changed since we started loading it, so ignore this callback
                return;
            }
            component[privateProperty] = asset.resource;
            this.doRecreatePhysicalShape(component);
        };

        const loadAndHandleAsset = (asset) => {
            asset.ready((asset) => {
                if (asset.data.containerAsset) {
                    const containerAsset = assets.get(asset.data.containerAsset);
                    if (containerAsset.loaded) {
                        onAssetFullyReady(asset);
                    } else {
                        containerAsset.ready(() => {
                            onAssetFullyReady(asset);
                        });
                        assets.load(containerAsset);
                    }
                } else {
                    onAssetFullyReady(asset);
                }
            });

            assets.load(asset);
        };

        const asset = assets.get(id);
        if (asset) {
            loadAndHandleAsset(asset);
        } else {
            assets.once(`add:${id}`, loadAndHandleAsset);
        }
    }

    doRecreatePhysicalShape(component) {
        const entity = component.entity;

        if (component._model || component._render) {
            this.destroyShape(component);

            component._shape = this.createPhysicalShape(entity, component);

            if (entity.rigidbody) {
                this._recreateBody(entity);
            } else {
                // note: unlike the base implementation, the trigger is
                // created even when the component is a compound child
                this._recreateTrigger(entity, component);
            }
        } else {
            this.beforeRemove(entity, component);
            this.system.onRemove(entity);
        }
    }

    updateTransform(component, position, rotation, scale) {
        if (component.shape) {
            const entityTransform = component.entity.getWorldTransform();
            const worldScale = entityTransform.getScale();

            // if the scale changed then recreate the shape
            const previousScale = component.shape.getLocalScaling();
            if (worldScale.x !== previousScale.x() ||
                worldScale.y !== previousScale.y() ||
                worldScale.z !== previousScale.z()) {
                this.doRecreatePhysicalShape(component);
            }
        }

        super.updateTransform(component, position, rotation, scale);
    }

    destroyShape(component) {
        if (!component._shape) {
            return;
        }

        const numShapes = component._shape.getNumChildShapes();
        for (let i = 0; i < numShapes; i++) {
            const shape = component._shape.getChildShape(i);
            Ammo.destroy(shape);
        }

        Ammo.destroy(component._shape);
        component._shape = null;
    }
}

// Compound Collision System
class CollisionCompoundSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        if (typeof Ammo !== 'undefined') {
            return new Ammo.btCompoundShape();
        }
        return undefined;
    }

    _addEachDescendant(entity) {
        if (!entity.collision || entity.rigidbody) {
            return;
        }

        entity.collision._compoundParent = this;

        if (entity !== this.entity) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
    }

    _updateEachDescendant(entity) {
        if (!entity.collision) {
            return;
        }

        if (entity.collision._compoundParent !== this) {
            return;
        }

        entity.collision._compoundParent = null;

        if (entity !== this.entity && !entity.rigidbody) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
    }

    _updateEachDescendantTransform(entity) {
        if (!entity.collision || entity.collision._compoundParent !== this.collision._compoundParent) {
            return;
        }

        this.collision.system.updateCompoundChildTransform(entity, false);
    }
}

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @category Physics
 */
class CollisionComponentSystem extends ComponentSystem {
    /**
     * Creates a new CollisionComponentSystem instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app);

        this.id = 'collision';

        this.ComponentType = CollisionComponent;

        this.implementations = { };

        this._triMeshCache = { };

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    initializeComponentData(component, data) {
        // resolve the type first - falsy values fall back to the current
        // type, matching the old initializer, and the private field is
        // written directly so the type setter does not fire changeType
        // before the component is initialized
        if (data.type) {
            component._type = data.type;
        }

        // asset takes priority over model and render but they are all trying
        // to change the mesh, so remove the conflicting inputs
        let properties = _properties;
        if (data.asset !== undefined) {
            properties = properties.filter(p => p !== 'model' && p !== 'render');
        } else if (data.model !== undefined) {
            properties = properties.filter(p => p !== 'asset');
        }

        // apply the user-supplied properties through the public setters - all
        // side effects are gated on _initialized, which is still false here
        for (const property of properties) {
            if (data[property] !== undefined) {
                component[property] = data[property];
            }
        }

        const impl = this._createImplementation(component._type);
        impl.beforeInitialize(component);

        super.initializeComponentData(component, data);

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

    cloneComponent(entity, clone) {
        const c = entity.collision;

        // type drives the implementation selection so it is handled outside
        // the shared property list
        const data = {
            enabled: c.enabled,
            type: c.type
        };

        for (const property of _properties) {
            data[property] = c[property];
        }

        return this.addComponent(clone, data);
    }

    onBeforeRemove(entity, component) {
        this.implementations[component.type].beforeRemove(entity, component);
        component.onBeforeRemove();

        // discard any stored collisions keyed to this entity so a later entity that reuses the
        // same GUID (e.g. after reloading the same scene) does not inherit stale tracking
        if (this.app.systems.rigidbody) {
            this.app.systems.rigidbody.clearEntityCollisions(entity);
        }
    }

    onRemove(entity) {
        if (entity.rigidbody && entity.rigidbody.body) {
            entity.rigidbody.disableSimulation();
        }

        if (entity.trigger) {
            entity.trigger.destroy();
            delete entity.trigger;
        }
    }

    updateCompoundChildTransform(entity, forceUpdate) {
        const parentComponent = entity.collision._compoundParent;
        if (parentComponent === entity.collision) return;

        if (entity.enabled && entity.collision.enabled && (entity._dirtyLocal || forceUpdate)) {
            const transform = this._getNodeTransform(entity, parentComponent.entity);
            const idx = parentComponent.getCompoundChildShapeIndex(entity.collision.shape);
            if (idx === null) {
                parentComponent.shape.addChildShape(transform, entity.collision.shape);
            } else {
                parentComponent.shape.updateChildTransform(idx, transform, true);
            }
            Ammo.destroy(transform);
        }
    }

    _removeCompoundChild(collision, shape) {
        if (collision.shape.getNumChildShapes() === 0) {
            return;
        }

        if (collision.shape.removeChildShape) {
            collision.shape.removeChildShape(shape);
        } else {
            const ind = collision.getCompoundChildShapeIndex(shape);
            if (ind !== null) {
                collision.shape.removeChildShapeByIndex(ind);
            }
        }
    }

    onTransformChanged(component, position, rotation, scale) {
        this.implementations[component.type].updateTransform(component, position, rotation, scale);
    }

    // Destroys the previous collision type and creates a new one based on the new type provided
    changeType(component, previousType, newType) {
        this.implementations[previousType].beforeRemove(component.entity, component);
        this.onRemove(component.entity);
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

            pos = p1;
            rot = quat;

            mat4.getTranslation(pos);
            rot.setFromMat4(mat4);
        } else {
            pos = node.getPosition();
            rot = node.getRotation();
        }
        const ammoQuat = new Ammo.btQuaternion();
        const transform = new Ammo.btTransform();

        transform.setIdentity();
        const origin = transform.getOrigin();
        const component = node.collision;

        if (component && component._hasOffset) {
            const lo = component.linearOffset;
            const ao = component.angularOffset;
            const newOrigin = p2;

            quat.copy(rot).transformVector(lo, newOrigin);
            newOrigin.add(pos);
            quat.copy(rot).mul(ao);

            origin.setValue(newOrigin.x, newOrigin.y, newOrigin.z);
            ammoQuat.setValue(quat.x, quat.y, quat.z, quat.w);
        } else {
            origin.setValue(pos.x, pos.y, pos.z);
            ammoQuat.setValue(rot.x, rot.y, rot.z, rot.w);
        }

        transform.setRotation(ammoQuat);
        Ammo.destroy(ammoQuat);

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
