import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { BufferUtils } from '../../../platform/graphics/buffer-utils.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { BODYTYPE_DYNAMIC } from '../rigid-body/constants.js';
import { ComponentSystem } from '../system.js';
import { CollisionComponent } from './component.js';
import { Trigger } from './trigger.js';

/**
 * @import { AppBase } from '../../app-base.js'
 * @import { Entity } from '../../entity.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 */

const mat4 = new Mat4();
const p1 = new Vec3();
const p2 = new Vec3();
const p3 = new Vec3();
const quat = new Quat();
const quat2 = new Quat();
const worldScale = new Vec3();
const linearVelocity = new Vec3();
const angularVelocity = new Vec3();

// The scale of a rotated entity is extracted from its world matrix with some float noise, so a
// mesh shape is only rebuilt when the entity world scale moves by more than this relative amount
const SCALE_CHANGE_TOLERANCE = 1e-5;

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

// Per-type collision implementations. Rows only carry the operations a type performs
// differently - call sites fall back to the shared flow functions below. createPhysicalShape
// returns an opaque backend shape handle, or undefined when no physics backend is installed.
const collisionImpls = {
    box: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'box',
            halfExtents: component.halfExtents
        })
    },

    sphere: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'sphere',
            radius: component.radius
        })
    },

    capsule: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'capsule',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        })
    },

    cylinder: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'cylinder',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        })
    },

    cone: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'cone',
            axis: component.axis,
            radius: component.radius,
            height: component.height
        })
    },

    mesh: {
        createPhysicalShape: createMeshShape,
        recreatePhysicalShapes: recreateMeshShapes
    },

    compound: {
        createPhysicalShape: (system, entity, component) => system.physicsWorld?.createShape({
            type: 'compound'
        })
    }
};

// Returns the per-type implementation for a collision type
function getImpl(type) {
    const impl = collisionImpls[type];
    Debug.assert(impl, `getImpl: Invalid collision system type: ${type}`);
    return impl;
}

// Shared per-type flow. Functions take the system explicitly - the per-type variance lives in
// the collisionImpls table above, which only carries the operations a type does differently.

// Called before the call to system.super.initializeComponentData is made
function beforeInitialize(system, component) {
    component._shape = null;
}

// Called after the call to system.super.initializeComponentData is made
function afterInitialize(system, component) {
    system.recreatePhysicalShapes(component);
    component._initialized = true;
}

// Re-creates the entity's rigid body after the collision shape changed. A dynamic body keeps its
// velocities across the swap, so a shape rebuilt mid-flight (a rescaled convex hull, say) does
// not stop the body
function recreateBody(entity) {
    const rigidbody = entity.rigidbody;

    const dynamic = rigidbody.type === BODYTYPE_DYNAMIC && !!rigidbody._body;
    if (dynamic) {
        linearVelocity.copy(rigidbody.linearVelocity);
        angularVelocity.copy(rigidbody.angularVelocity);
    }

    rigidbody.disableSimulation();
    rigidbody.createBody();

    if (entity.enabled && rigidbody.enabled) {
        rigidbody.enableSimulation();

        if (dynamic) {
            rigidbody.linearVelocity = linearVelocity;
            rigidbody.angularVelocity = angularVelocity;
        }
    }
}

// Creates the entity's trigger, or re-initializes an existing one
function recreateTrigger(system, entity, component) {
    if (!entity.trigger) {
        entity.trigger = new Trigger(system.app, component);
    } else {
        entity.trigger.initialize();
    }
}

function destroyShape(system, component) {
    if (component._shape) {
        system.physicsWorld.destroyShape(component._shape);
        component._shape = null;
    }
    component._builtWorldScale = null;
}

function beforeRemove(system, entity, component) {
    system._unwatchMeshScale(component);

    if (component._shape) {
        if (component._compoundParent && !component._compoundParent.entity._destroying) {
            system._removeCompoundChild(component._compoundParent, component._shape);

            if (component._compoundParent.entity.rigidbody) {
                component._compoundParent.entity.rigidbody.activate();
            }
        }

        component._compoundParent = null;

        destroyShape(system, component);
    }
}

// Re-creates rigid bodies / triggers
function recreateShapes(system, component) {
    const entity = component.entity;
    const world = system.physicsWorld;

    if (world) {
        if (entity.trigger) {
            entity.trigger.destroy();
            delete entity.trigger;
        }

        if (component._shape) {
            if (component._compoundParent) {
                if (component !== component._compoundParent) {
                    system._removeCompoundChild(component._compoundParent, component._shape);
                }

                if (component._compoundParent.entity.rigidbody) {
                    component._compoundParent.entity.rigidbody.activate();
                }
            }

            destroyShape(system, component);
        }

        component._shape = getImpl(component._type).createPhysicalShape(system, entity, component);

        const firstCompoundChild = !component._compoundParent;

        if (component._type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
            component._compoundParent = component;

            entity.forEach(system._addEachDescendant, component);
        } else if (component._type !== 'compound') {
            if (!entity.rigidbody) {
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
                    system.recreatePhysicalShapes(component._compoundParent);
                } else {
                    system.updateCompoundChildTransform(entity, true);

                    if (component._compoundParent.entity.rigidbody) {
                        component._compoundParent.entity.rigidbody.activate();
                    }
                }
            }
        }

        if (entity.rigidbody) {
            recreateBody(entity);
        } else if (!component._compoundParent) {
            recreateTrigger(system, entity, component);
        }
    }
}

// Builds a PhysicsMeshSource for one mesh at the entity world scale. Vertex and index data are
// exposed through lazy accessors so they are only extracted when the backend actually builds
// triangle data - sources whose geometry is already cached (by mesh id) never touch the vertex
// buffer. A model node places its mesh in model space: the node pose and scale are applied to
// the source and the entity scale multiplies both, which is what scaling a compound of node
// shapes resolves to.
function createMeshSource(system, mesh, node, entityScale, convexHull, checkDuplicates) {
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
                    positions = BufferUtils.createStorageView(vb, Float32Array, element.offset);
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
        scale: entityScale.clone(),
        position: new Vec3(),
        rotation: new Quat()
    };

    if (node) {
        system._getNodeTransform(node, null, source.position, source.rotation);
        source.position.mul(entityScale);
        source.scale.mul(node.getWorldTransform().getScale());
    }

    return source;
}

function createMeshShape(system, entity, component) {
    const world = system.physicsWorld;
    if (!world) return undefined;

    if (component._model || component._render) {

        const scale = entity.getWorldTransform().getScale();
        const sources = [];

        if (component._render) {
            const meshes = component._render.meshes;
            for (let i = 0; i < meshes.length; i++) {
                sources.push(createMeshSource(system, meshes[i], null, scale, component._convexHull, component._checkVertexDuplicates));
            }
        } else if (component._model) {
            const meshInstances = component._model.meshInstances;
            for (let i = 0; i < meshInstances.length; i++) {
                sources.push(createMeshSource(system, meshInstances[i].mesh, meshInstances[i].node, scale, false, component._checkVertexDuplicates));
            }
        }

        // record the scale the shape is built with and watch the entity for changes to it, so a
        // runtime rescale rebuilds the shape (see _updateMeshScales)
        component._builtWorldScale = scale;
        if (world.supportsMeshScaling) {
            system._watchMeshScale(component);
        }

        return world.createShape({
            type: 'mesh',
            sources: sources
        });
    }

    return undefined;
}

// Rebuilds the mesh shape from the component's current model or render sources, skipping any
// asset loading. The shared flow detaches a compound child from its parent compound and re-adds
// the rebuilt shape, and only creates a trigger for a stand-alone component
function doRecreateMeshShape(system, component) {
    if (component._model || component._render) {
        recreateShapes(system, component);
    } else {
        beforeRemove(system, component.entity, component);
        system.onRemove(component.entity);
    }
}

function loadMeshAsset(system, component, id, property) {
    const assets = system.app.assets;
    // write the loaded resource to the private field - the public setter
    // would trigger a second shape rebuild via doRecreateMeshShape
    const privateProperty = `_${property}`;
    const previousPropertyValue = component[privateProperty];

    const onAssetFullyReady = (asset) => {
        if (component.entity.collision !== component) {
            // the component was removed while the asset was loading
            return;
        }

        if (component[privateProperty] !== previousPropertyValue) {
            // the asset has changed since we started loading it, so ignore this callback
            return;
        }
        component[privateProperty] = asset.resource;
        doRecreateMeshShape(system, component);
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

function recreateMeshShapes(system, component) {
    if (component._renderAsset || component._asset) {
        if (component.enabled && component.entity.enabled) {
            loadMeshAsset(
                system,
                component,
                component._renderAsset || component._asset,
                component._renderAsset ? 'render' : 'model'
            );
            return;
        }
    }

    doRecreateMeshShape(system, component);
}

// Returns whether an entity world scale differs from the scale a mesh shape was built with by
// more than float noise
function scaleChanged(scale, builtScale) {
    return Math.abs(scale.x - builtScale.x) > SCALE_CHANGE_TOLERANCE * Math.max(1, Math.abs(builtScale.x)) ||
           Math.abs(scale.y - builtScale.y) > SCALE_CHANGE_TOLERANCE * Math.max(1, Math.abs(builtScale.y)) ||
           Math.abs(scale.z - builtScale.z) > SCALE_CHANGE_TOLERANCE * Math.max(1, Math.abs(builtScale.z));
}

/**
 * Manages creation of {@link CollisionComponent}s.
 *
 * @category Physics
 */
class CollisionComponentSystem extends ComponentSystem {
    /**
     * The mesh components with a built shape, watched for changes to their entity world scale.
     * Maintained by createMeshShape and beforeRemove.
     *
     * @type {CollisionComponent[]}
     * @private
     */
    _meshComponents = [];

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

        const impl = getImpl(component._type);
        (impl.beforeInitialize ?? beforeInitialize)(this, component);

        super.initializeComponentData(component, data);

        afterInitialize(this, component);
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
        beforeRemove(this, entity, component);
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

    /**
     * Starts watching a mesh component's entity world scale (see _updateMeshScales).
     *
     * @param {CollisionComponent} component - The mesh collision component.
     * @private
     */
    _watchMeshScale(component) {
        if (!this._meshComponents.includes(component)) {
            this._meshComponents.push(component);
        }
    }

    /**
     * Stops watching a component's entity world scale.
     *
     * @param {CollisionComponent} component - The collision component.
     * @private
     */
    _unwatchMeshScale(component) {
        const index = this._meshComponents.indexOf(component);
        if (index !== -1) {
            this._meshComponents.splice(index, 1);
        }
    }

    /**
     * Rebuilds the mesh shapes whose entity world scale no longer matches the scale they were
     * built with. Driven by the rigid body system at the start of each physics step, so like
     * the other entity to physics syncs it pauses with the simulation and the first step after
     * resuming catches up.
     *
     * @ignore
     */
    _updateMeshScales() {
        const components = this._meshComponents;

        // backwards, so components watched by a nested rebuild (they are appended) wait for the
        // next step and a removal never skips an entry
        for (let i = components.length - 1; i >= 0; i--) {
            const component = components[i];
            if (!component._shape || !component._builtWorldScale || !component.enabled || !component.entity.enabled) {
                continue;
            }

            const scale = component.entity.getWorldTransform().getScale(worldScale);
            if (scaleChanged(scale, component._builtWorldScale)) {
                doRecreateMeshShape(this, component);
            }
        }
    }

    // Destroys the previous collision type and creates a new one based on the new type provided
    changeType(component, previousType, newType) {
        beforeRemove(this, component.entity, component);
        this.onRemove(component.entity);

        const impl = getImpl(newType);
        (impl.beforeInitialize ?? beforeInitialize)(this, component);
        afterInitialize(this, component);
    }

    // Recreates rigid bodies or triggers for the specified component
    recreatePhysicalShapes(component) {
        const impl = getImpl(component.type);
        (impl.recreatePhysicalShapes ?? recreateShapes)(this, component);
    }

    /**
     * Rebuilds a mesh component's shape from its current model or render sources, skipping any
     * asset loading. Used by the mesh source setters, which assign the resource directly.
     *
     * @param {CollisionComponent} component - The mesh collision component to rebuild.
     * @ignore
     */
    doRecreatePhysicalShape(component) {
        Debug.assert(component._type === 'mesh', 'CollisionComponentSystem#doRecreatePhysicalShape: called for a non-mesh collision component.');
        doRecreateMeshShape(this, component);
    }

    /**
     * An {@link Entity#forEach} callback that wires a descendant of a compound root to it and
     * rebuilds the descendant's shape. Invoked with `this` set to the compound root component.
     *
     * @param {Entity} entity - The visited descendant entity.
     * @private
     */
    _addEachDescendant(entity) {
        if (!entity.collision || entity.rigidbody) {
            return;
        }

        entity.collision._compoundParent = this;

        if (entity !== this.entity) {
            entity.collision.system.recreatePhysicalShapes(entity.collision);
        }
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
