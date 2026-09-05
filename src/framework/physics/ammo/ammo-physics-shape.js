import { Debug } from '../../../core/debug.js';

/**
 * @import { AmmoPhysicsWorld } from './ammo-physics-world.js'
 * @import { PhysicsMeshSource, PhysicsShapeDesc } from '../physics-world.js'
 * @import { Quat } from '../../../core/math/quat.js'
 * @import { Vec3 } from '../../../core/math/vec3.js'
 */

// A rotated but unscaled entity extracts a scale like 0.9999999 from its world matrix - treat
// scales within this tolerance of unity as unit
const UNIT_SCALE_TOLERANCE = 1e-5;

/**
 * Writes a position/rotation pair into the world's cached btTransform and returns it.
 *
 * @param {AmmoPhysicsWorld} world - The world providing the temporaries.
 * @param {Vec3} position - The position.
 * @param {Quat} rotation - The rotation.
 * @returns {object} The world's btTransform temporary.
 */
function getTransform(world, position, rotation) {
    const transform = world._btTransform;
    const vec = world._btVec1;
    const quat = world._btQuat;

    vec.setValue(position.x, position.y, position.z);
    quat.setValue(rotation.x, rotation.y, rotation.z, rotation.w);
    transform.setOrigin(vec);
    transform.setRotation(quat);

    return transform;
}

/**
 * Returns whether a source scale is unit (or absent), within the float noise a rotated but
 * unscaled entity carries in the scale extracted from its world matrix.
 *
 * @param {Vec3|null} scale - The source scale, or null.
 * @returns {boolean} True for unit scale.
 */
function isUnitScale(scale) {
    return !scale || (
        Math.abs(scale.x - 1) <= UNIT_SCALE_TOLERANCE &&
        Math.abs(scale.y - 1) <= UNIT_SCALE_TOLERANCE &&
        Math.abs(scale.z - 1) <= UNIT_SCALE_TOLERANCE
    );
}

/**
 * Returns the cached triangle data entry for a source, building it on first use. The cache is
 * keyed by the source id so sources sharing geometry share triangle data - source data
 * accessors are only read on a cache miss.
 *
 * The cached triangle data is unit scale; each instance applies its own scale through the
 * btScaledBvhTriangleMeshShape wrapper built by createTriMeshChild. Ammo builds without that
 * binding cannot scale a sub-shape independently of the shared data (btTriangleMeshShape
 * stores its local scaling on the shared btStridingMeshInterface), so on those the source scale
 * is baked into the cached data instead and the first shape to build a mesh decides the scale
 * for every later shape sharing it - the behaviour before the binding existed.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @returns {{ triMesh: object, bvhShape: object|null }} The cache entry.
 */
function getTriMesh(world, source) {
    let entry = world._triMeshCache.get(source.id);
    if (!entry) {
        const positions = source.positions;
        const stride = source.stride;
        const indices = source.indices;
        const base = source.base;
        const numTriangles = source.count / 3;
        const checkDupes = source.checkDuplicates;

        const v1 = new Ammo.btVector3();
        let i1, i2, i3;

        const triMesh = new Ammo.btTriangleMesh();
        entry = { triMesh, bvhShape: null };
        world._triMeshCache.set(source.id, entry);

        const vertexCache = new Map();
        Debug.assert(typeof triMesh.getIndexedMeshArray === 'function', 'Ammo.js version is too old, please update to a newer Ammo.');
        const indexedArray = triMesh.getIndexedMeshArray();
        indexedArray.at(0).m_numTriangles = numTriangles;

        // legacy builds bake the scale into the shared data (see above)
        const bakeScale = world._hasScaledTriMesh ? null : source.scale;
        const sx = bakeScale ? bakeScale.x : 1;
        const sy = bakeScale ? bakeScale.y : 1;
        const sz = bakeScale ? bakeScale.z : 1;

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

    return entry;
}

/**
 * Builds a convex hull sub-shape from a source and adds it to a compound.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {object} compound - The btCompoundShape to add to.
 * @param {PhysicsMeshSource} source - The geometry source.
 */
function createHullChild(world, compound, source) {
    const hull = new Ammo.btConvexHullShape();

    const point = new Ammo.btVector3();

    const positions = source.positions;
    const stride = source.stride;
    const scale = source.scale;
    const sx = scale ? scale.x : 1;
    const sy = scale ? scale.y : 1;
    const sz = scale ? scale.z : 1;

    for (let i = 0; i < positions.length; i += stride) {
        point.setValue(positions[i] * sx, positions[i + 1] * sy, positions[i + 2] * sz);

        // No need to calculate the aabb here. We'll do it after all points are added.
        hull.addPoint(point, false);
    }

    Ammo.destroy(point);

    hull.recalcLocalAabb();
    hull.setMargin(0.01);   // Note: default margin is 0.04

    compound.addChildShape(getTransform(world, source.position, source.rotation), hull);
}

/**
 * Builds a triangle mesh sub-shape from a source and adds it to a compound. The sub-shape is a
 * btScaledBvhTriangleMeshShape carrying the source scale around the shared unit-scale BVH of
 * the cached triangle data, so instances of one mesh share its triangle data and BVH whatever
 * their scale. Never call setLocalScaling on the shared btBvhTriangleMeshShape - Bullet stores
 * that scaling on the shared btStridingMeshInterface, which would rescale every instance.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {object} compound - The btCompoundShape to add to.
 * @param {PhysicsMeshSource} source - The geometry source.
 */
function createTriMeshChild(world, compound, source) {
    const entry = getTriMesh(world, source);
    const scale = source.scale;
    let child;

    if (world._hasScaledTriMesh) {
        if (!entry.bvhShape) {
            entry.bvhShape = new Ammo.btBvhTriangleMeshShape(entry.triMesh, true /* useQuantizedAabbCompression */);
        }

        // every instance gets a wrapper, unit scale included, so no sub-shape object is ever
        // shared between compounds
        const vec = world._btVec2;
        vec.setValue(scale ? scale.x : 1, scale ? scale.y : 1, scale ? scale.z : 1);
        child = new Ammo.btScaledBvhTriangleMeshShape(entry.bvhShape, vec);
    } else {
        // legacy build: getTriMesh baked the scale into the shared triangle data
        if (!isUnitScale(scale)) {
            Debug.warnOnce('This Ammo.js build does not expose btScaledBvhTriangleMeshShape: mesh colliders sharing a mesh at different scales, and rescaling a mesh collider at runtime, are not supported. Update Ammo.js.');
        }
        child = new Ammo.btBvhTriangleMeshShape(entry.triMesh, true /* useQuantizedAabbCompression */);
    }

    compound.addChildShape(getTransform(world, source.position, source.rotation), child);
}

/**
 * Per-type native shape creation. Sizes use engine conventions (full heights) and are
 * converted to Bullet conventions here.
 *
 * @type {Object<string, (world: AmmoPhysicsWorld, desc: PhysicsShapeDesc) => object>}
 */
const shapeFactories = {
    box: (world, desc) => {
        const he = desc.halfExtents;
        const ammoHe = new Ammo.btVector3(he.x, he.y, he.z);
        const shape = new Ammo.btBoxShape(ammoHe);
        Ammo.destroy(ammoHe);
        return shape;
    },

    sphere: (world, desc) => {
        return new Ammo.btSphereShape(desc.radius);
    },

    capsule: (world, desc) => {
        const radius = desc.radius;
        const height = Math.max(desc.height - 2 * radius, 0);
        switch (desc.axis) {
            case 0: return new Ammo.btCapsuleShapeX(radius, height);
            case 2: return new Ammo.btCapsuleShapeZ(radius, height);
            default: return new Ammo.btCapsuleShape(radius, height);
        }
    },

    cylinder: (world, desc) => {
        const radius = desc.radius;
        const height = desc.height;

        let halfExtents = null;
        let shape = null;
        switch (desc.axis) {
            case 0:
                halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
                shape = new Ammo.btCylinderShapeX(halfExtents);
                break;
            case 2:
                halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
                shape = new Ammo.btCylinderShapeZ(halfExtents);
                break;
            default:
                halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
                shape = new Ammo.btCylinderShape(halfExtents);
                break;
        }
        Ammo.destroy(halfExtents);
        return shape;
    },

    cone: (world, desc) => {
        switch (desc.axis) {
            case 0: return new Ammo.btConeShapeX(desc.radius, desc.height);
            case 2: return new Ammo.btConeShapeZ(desc.radius, desc.height);
            default: return new Ammo.btConeShape(desc.radius, desc.height);
        }
    },

    mesh: (world, desc) => {
        const shape = new Ammo.btCompoundShape();

        const sources = desc.sources;
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            if (source.convexHull) {
                createHullChild(world, shape, source);
            } else {
                createTriMeshChild(world, shape, source);
            }
        }

        return shape;
    },

    compound: (world, desc) => {
        return new Ammo.btCompoundShape();
    }
};

/**
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {PhysicsShapeDesc} desc - The shape descriptor.
 * @returns {object} The native shape, tagged with its descriptor type for destroyShape.
 */
function createShape(world, desc) {
    const factory = shapeFactories[desc.type];
    Debug.assert(factory, `AmmoPhysicsWorld#createShape: invalid shape type: ${desc.type}`);

    const shape = factory(world, desc);
    shape._shapeType = desc.type;
    return shape;
}

/**
 * @param {object} shape - The native shape to destroy.
 */
function destroyShape(shape) {
    // mesh shapes own their sub-shapes (compound children are owned by other components,
    // and the cached triangle data and its shared BVH outlive the shape)
    if (shape._shapeType === 'mesh') {
        const numShapes = shape.getNumChildShapes();
        for (let i = 0; i < numShapes; i++) {
            Ammo.destroy(shape.getChildShape(i));
        }
    }

    Ammo.destroy(shape);
}

/**
 * Returns the index of a child within a compound shape by native pointer identity, or -1.
 *
 * @param {object} compound - The btCompoundShape.
 * @param {object} child - The child shape.
 * @returns {number} The child index, or -1 if absent.
 */
function indexOfCompoundChild(compound, child) {
    const childPointer = Ammo.getPointer(child);
    const numShapes = compound.getNumChildShapes();

    for (let i = 0; i < numShapes; i++) {
        if (Ammo.getPointer(compound.getChildShape(i)) === childPointer) {
            return i;
        }
    }

    return -1;
}

/**
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {object} compound - The btCompoundShape.
 * @param {object} child - The child shape.
 * @param {Vec3} position - The child position in the compound's local space.
 * @param {Quat} rotation - The child rotation in the compound's local space.
 */
function addCompoundChild(world, compound, child, position, rotation) {
    compound.addChildShape(getTransform(world, position, rotation), child);
}

/**
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {object} compound - The btCompoundShape.
 * @param {object} child - The child shape.
 * @param {Vec3} position - The child position in the compound's local space.
 * @param {Quat} rotation - The child rotation in the compound's local space.
 */
function updateCompoundChild(world, compound, child, position, rotation) {
    const transform = getTransform(world, position, rotation);
    const idx = indexOfCompoundChild(compound, child);
    if (idx < 0) {
        compound.addChildShape(transform, child);
    } else {
        compound.updateChildTransform(idx, transform, true);
    }
}

/**
 * @param {object} compound - The btCompoundShape.
 * @param {object} child - The child shape.
 */
function removeCompoundChild(compound, child) {
    if (compound.getNumChildShapes() === 0) {
        return;
    }

    if (compound.removeChildShape) {
        compound.removeChildShape(child);
    } else {
        const idx = indexOfCompoundChild(compound, child);
        if (idx >= 0) {
            compound.removeChildShapeByIndex(idx);
        }
    }
}

export { createShape, destroyShape, addCompoundChild, updateCompoundChild, removeCompoundChild };
