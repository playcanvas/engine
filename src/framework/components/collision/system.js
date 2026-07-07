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
const p3 = new Vec3();
const quat = new Quat();
const quat2 = new Quat();

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
        const world = this.system.physicsWorld;

        if (world) {
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
                    if (firstCompoundChild && world.getCompoundChildCount(component._compoundParent.shape) === 0) {
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
            this.system.physicsWorld.destroyShape(component._shape);
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
        return this.system.physicsWorld?.createShape({
            type: 'box',
            halfExtents: component.halfExtents
        });
    }
}

// Sphere Collision System
class CollisionSphereSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        return this.system.physicsWorld?.createShape({
            type: 'sphere',
            radius: component.radius
        });
    }
}

// Capsule Collision System
class CollisionCapsuleSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        return this.system.physicsWorld?.createShape({
            type: 'capsule',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        });
    }
}

// Cylinder Collision System
class CollisionCylinderSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        return this.system.physicsWorld?.createShape({
            type: 'cylinder',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        });
    }
}

// Cone Collision System
class CollisionConeSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        return this.system.physicsWorld?.createShape({
            type: 'cone',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        });
    }
}

// Mesh Collision System
class CollisionMeshSystemImpl extends CollisionSystemImpl {
    // override for the mesh implementation because the asset model needs
    // special handling
    beforeInitialize(component) {}

    // Builds a PhysicsMeshSource for one mesh. Vertex and index data are exposed through lazy
    // accessors so they are only extracted when the backend actually builds triangle data -
    // sources whose geometry is already cached (by mesh id) never touch the vertex buffer.
    _createMeshSource(mesh, node, bakeScale, convexHull, checkDuplicates) {
        let positions = null;
        let stride = 0;
        let indices = null;
        let extracted = false;

        const extract = () => {
            if (extracted) return;
            extracted = true;

            if (convexHull) {
                // hulls consume every position, tightly packed
                positions = [];
                mesh.getPositions(positions);
                stride = 3;
            } else {
                const vb = mesh.vertexBuffer;
                const format = vb.getFormat();
                for (let i = 0; i < format.elements.length; i++) {
                    const element = format.elements[i];
                    if (element.name === SEMANTIC_POSITION) {
                        positions = new Float32Array(vb.lock(), element.offset);
                        stride = element.stride / 4;
                        break;
                    }
                }

                indices = [];
                mesh.getIndices(indices);
            }
        };

        const source = {
            id: mesh.id,
            get positions() {
                extract();
                return positions;
            },
            get stride() {
                extract();
                return stride;
            },
            get indices() {
                extract();
                return indices;
            },
            base: mesh.primitive[0].base,
            count: mesh.primitive[0].count,
            convexHull: convexHull,
            checkDuplicates: checkDuplicates,
            bakeScale: bakeScale,
            shapeScale: node ? this.system._getNodeScaling(node) : null,
            position: new Vec3(),
            rotation: new Quat()
        };

        if (node) {
            this.system._getNodeTransform(node, null, source.position, source.rotation);
        }

        return source;
    }

    createPhysicalShape(entity, component) {
        const world = this.system.physicsWorld;
        if (!world) return undefined;

        if (component._model || component._render) {

            const entityTransform = entity.getWorldTransform();
            const scale = entityTransform.getScale();
            const sources = [];
            let shapeScale = null;

            if (component._render) {
                // bake the entity scale into the vertices
                const meshes = component._render.meshes;
                for (let i = 0; i < meshes.length; i++) {
                    sources.push(this._createMeshSource(meshes[i], null, scale, component._convexHull, component._checkVertexDuplicates));
                }
            } else if (component._model) {
                // scale the whole shape by the entity scale
                const meshInstances = component._model.meshInstances;
                for (let i = 0; i < meshInstances.length; i++) {
                    sources.push(this._createMeshSource(meshInstances[i].mesh, meshInstances[i].node, null, false, component._checkVertexDuplicates));
                }
                shapeScale = scale;
            }

            // record the scale the shape was built with, for the rebuild-on-scale-change check
            component._builtWorldScale = scale;

            return world.createShape({
                type: 'mesh',
                sources: sources,
                scale: shapeScale
            });
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
        if (component.shape && component._builtWorldScale) {
            const entityTransform = component.entity.getWorldTransform();
            const worldScale = entityTransform.getScale();

            // if the scale changed then recreate the shape
            if (!worldScale.equals(component._builtWorldScale)) {
                this.doRecreatePhysicalShape(component);
            }
        }

        super.updateTransform(component, position, rotation, scale);
    }
}

// Compound Collision System
class CollisionCompoundSystemImpl extends CollisionSystemImpl {
    createPhysicalShape(entity, component) {
        return this.system.physicsWorld?.createShape({ type: 'compound' });
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

        this.on('beforeremove', this.onBeforeRemove, this);
        this.on('remove', this.onRemove, this);
    }

    /**
     * The physics backend installed on the rigid body system, or null.
     *
     * @type {*}
     * @ignore
     */
    get physicsWorld() {
        return this.app.systems.rigidbody?.physicsWorld ?? null;
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
        // gate on the backend body, not the public getter - the getter surfaces the NATIVE
        // body, which backends without native handles keep null
        if (entity.rigidbody && entity.rigidbody._body) {
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
            this._getNodeTransform(entity, parentComponent.entity, p3, quat2);
            this.physicsWorld.updateCompoundChild(parentComponent.shape, entity.collision.shape, p3, quat2);
        }
    }

    _removeCompoundChild(collision, shape) {
        this.physicsWorld.removeCompoundChild(collision.shape, shape);
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
        return node.getWorldTransform().getScale();
    }

    /**
     * Computes a node's pose (with any collision component offsets applied), optionally
     * relative to an ancestor node, ignoring scale.
     *
     * @param {GraphNode} node - The node to read.
     * @param {GraphNode|null} relative - The ancestor to compute the pose relative to, or null
     * for the world pose.
     * @param {Vec3} position - The vector to write the position to.
     * @param {Quat} rotation - The quaternion to write the rotation to.
     * @private
     */
    _getNodeTransform(node, relative, position, rotation) {
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

        const component = node.collision;
        if (component && component._hasOffset) {
            const lo = component.linearOffset;
            const ao = component.angularOffset;
            const newOrigin = p2;

            quat.copy(rot).transformVector(lo, newOrigin);
            newOrigin.add(pos);
            quat.copy(rot).mul(ao);

            position.copy(newOrigin);
            rotation.copy(quat);
        } else {
            position.copy(pos);
            rotation.copy(rot);
        }
    }
}

export { CollisionComponentSystem };
