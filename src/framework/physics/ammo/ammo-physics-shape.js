import { Debug } from '../../../core/debug.js';

/**
 * @import { AmmoPhysicsWorld } from './ammo-physics-world.js'
 * @import { PhysicsMeshSource, PhysicsShapeDesc } from '../physics-world.js'
 * @import { Quat } from '../../../core/math/quat.js'
 * @import { Vec3 } from '../../../core/math/vec3.js'
 */

// Bake scales within this tolerance of unity are treated as unscaled. The world scale of a
// rotated but unscaled entity is extracted from its world matrix, so it carries float noise -
// without the tolerance such entities would needlessly bypass the triangle data cache
const UNIT_SCALE_TOLERANCE = 1e-5;

/**
 * Returns whether a bake scale is close enough to unity to be ignored.
 *
 * @param {Vec3|null} scale - The bake scale, or null.
 * @returns {boolean} True if the scale is null or within tolerance of (1, 1, 1).
 */
function isUnitScale(scale) {
    return !scale || (
        Math.abs(scale.x - 1) <= UNIT_SCALE_TOLERANCE &&
        Math.abs(scale.y - 1) <= UNIT_SCALE_TOLERANCE &&
        Math.abs(scale.z - 1) <= UNIT_SCALE_TOLERANCE
    );
}

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
 * Returns the built triangle mesh for a source, building and caching it on first use. The
 * cache is keyed by the source id so sources sharing geometry share triangle data - source
 * data accessors are only read on a cache miss.
 *
 * Only unscaled triangle data enters the cache: an id can be shared by sources with different
 * bake scales, so baked-scale data would leak one component's scale into another's shape and
 * make a rebuild after a scale change return stale geometry. Scaled builds are appended to
 * ownedTriMeshes instead, and are destroyed with the shape that owns them.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @param {object[]} ownedTriMeshes - Receives the built trimesh when it cannot be cached.
 * @returns {object} The btTriangleMesh.
 */
function getTriMesh(world, source, ownedTriMeshes) {
    const bakeScale = isUnitScale(source.bakeScale) ? null : source.bakeScale;

    let triMesh = bakeScale ? null : world._triMeshCache.get(source.id);
    if (!triMesh) {
        const positions = source.positions;
        const stride = source.stride;
        const indices = source.indices;
        const base = source.base;
        const numTriangles = source.count / 3;
        const checkDupes = source.checkDuplicates;

        const v1 = new Ammo.btVector3();
        let i1, i2, i3;

        triMesh = new Ammo.btTriangleMesh();
        if (bakeScale) {
            ownedTriMeshes.push(triMesh);
        } else {
            world._triMeshCache.set(source.id, triMesh);
        }

        const vertexCache = new Map();
        Debug.assert(typeof triMesh.getIndexedMeshArray === 'function', 'Ammo.js version is too old, please update to a newer Ammo.');
        const indexedArray = triMesh.getIndexedMeshArray();
        indexedArray.at(0).m_numTriangles = numTriangles;

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

    return triMesh;
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
    const bakeScale = source.bakeScale;
    const sx = bakeScale ? bakeScale.x : 1;
    const sy = bakeScale ? bakeScale.y : 1;
    const sz = bakeScale ? bakeScale.z : 1;

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
 * Builds a triangle mesh sub-shape from a source and adds it to a compound.
 *
 * @param {AmmoPhysicsWorld} world - The owning world.
 * @param {object} compound - The btCompoundShape to add to.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @param {object[]} ownedTriMeshes - Receives trimeshes owned by the compound.
 */
function createTriMeshChild(world, compound, source, ownedTriMeshes) {
    const triMesh = getTriMesh(world, source, ownedTriMeshes);

    const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, true /* useQuantizedAabbCompression */);

    const shapeScale = source.shapeScale;
    if (shapeScale) {
        const vec = world._btVec1;
        vec.setValue(shapeScale.x, shapeScale.y, shapeScale.z);
        triMeshShape.setLocalScaling(vec);
    }

    compound.addChildShape(getTransform(world, source.position, source.rotation), triMeshShape);
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

        // triangle data built with a baked scale is private to this shape - it stays out of
        // the shared cache and is destroyed with the shape
        const ownedTriMeshes = [];

        const sources = desc.sources;
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            if (source.convexHull) {
                createHullChild(world, shape, source);
            } else {
                createTriMeshChild(world, shape, source, ownedTriMeshes);
            }
        }

        if (ownedTriMeshes.length > 0) {
            shape._ownedTriMeshes = ownedTriMeshes;
        }

        if (desc.scale) {
            const vec = new Ammo.btVector3(desc.scale.x, desc.scale.y, desc.scale.z);
            shape.setLocalScaling(vec);
            Ammo.destroy(vec);
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
    // and cached triangle data outlives the shape)
    if (shape._shapeType === 'mesh') {
        const numShapes = shape.getNumChildShapes();
        for (let i = 0; i < numShapes; i++) {
            Ammo.destroy(shape.getChildShape(i));
        }

        // triangle data built with a baked scale is owned by the shape, not the cache
        const ownedTriMeshes = shape._ownedTriMeshes;
        if (ownedTriMeshes) {
            for (let i = 0; i < ownedTriMeshes.length; i++) {
                Ammo.destroy(ownedTriMeshes[i]);
            }
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
