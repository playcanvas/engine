import { Debug } from '../../../core/debug.js';

/**
 * @import { JoltPhysicsWorld } from './jolt-physics-world.js'
 * @import { PhysicsMeshSource, PhysicsShapeDesc } from '../physics-world.js'
 * @import { Quat } from '../../../core/math/quat.js'
 * @import { Vec3 } from '../../../core/math/vec3.js'
 */

// Jolt's default convex radius, which rounds the edges of boxes and cylinders by shrinking the
// core shape and adding it back around it, so the surface stays at the given size
const CONVEX_RADIUS = 0.05;

// A rotated but unscaled entity extracts a scale like 0.9999999 from its world matrix - treat
// scales within this tolerance of unity as unit
const UNIT_SCALE_TOLERANCE = 1e-5;

// The smallest box edge used to approximate the inertia of a shape without volume
const MIN_INERTIA_EXTENT = 0.01;

// sin(45 degrees), for the rotations that align the Y aligned primitives with X or Z
const SQRT_HALF = Math.SQRT1_2;

/**
 * A triangle mesh cached by source id and shared by every shape built from that source.
 *
 * @typedef {object} JoltMeshEntry
 * @property {number} id - The source id the entry is cached under.
 * @property {object} shape - The unit scale mesh shape, referenced once by the cache.
 * @property {number} refCount - The number of shapes using the mesh.
 * @ignore
 */

/**
 * Creates the shape for a shape description.
 *
 * @callback JoltShapeFactory
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsShapeDesc} desc - The shape description.
 * @param {JoltMeshEntry[]} entries - Receives the cached meshes the shape uses.
 * @returns {object} The shape, referenced once.
 * @ignore
 */

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
 * Removes the cached wrappers of a native shape that is about to be freed, so that a shape
 * allocated at the same address later gets a fresh wrapper instead of this one.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {object} shape - The shape wrapper.
 */
function uncache(Jolt, shape) {
    if (typeof Jolt.getCache === 'function') {
        const pointer = Jolt.getPointer(shape);
        delete Jolt.getCache(Jolt.Shape)[pointer];
        delete Jolt.getCache(Jolt.MutableCompoundShape)[pointer];
    }
}

/**
 * Returns a new empty shape: collides with nothing, and stands in for shapes that cannot be
 * built.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @returns {object} The shape, referenced once.
 */
function createEmptyShape(world) {
    const settings = new world._jolt.EmptyShapeSettings();
    const shape = settings.Create().Get();
    shape.AddRef();
    world._jolt.destroy(settings);
    return shape;
}

/**
 * Creates a shape from settings and destroys the settings. Jolt places the center of mass of a
 * shape where its mass is, but the engine, like Bullet, rotates a body about the origin of its
 * shape (the entity position with any collision offset), so a shape whose center of mass is
 * elsewhere, such as a cone or a compound of offset parts, is wrapped to move it to the origin.
 * Settings that cannot be built are reported and replaced by an empty shape.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} settings - The shape settings, destroyed by this call.
 * @param {string} what - The kind of shape, for the report.
 * @returns {object} The shape, referenced once.
 */
function build(world, settings, what) {
    const Jolt = world._jolt;

    let outer = settings;
    let result = settings.Create();
    if (!result.HasError()) {
        const com = result.Get().GetCenterOfMass();
        const x = com.GetX(), y = com.GetY(), z = com.GetZ();
        if (x !== 0 || y !== 0 || z !== 0) {
            const vec = world._vec;
            vec.Set(-x, -y, -z);
            outer = new Jolt.OffsetCenterOfMassShapeSettings(vec, settings);
            result = outer.Create();
        }
    }

    let shape = null;
    if (result.HasError()) {
        Debug.warn(`JoltPhysicsWorld: cannot create a ${what} collision shape ` +
            `(${result.GetError().c_str()}). It is replaced by an empty shape.`);
    } else {
        shape = result.Get();
        shape.AddRef();
    }

    // the outer settings hold references to any inner ones, and the shape to its inner shapes
    Jolt.destroy(outer);

    return shape ?? createEmptyShape(world);
}

/**
 * Wraps the settings of a primitive aligned with Y so that it is aligned with the given axis
 * instead.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} settings - The Y aligned shape settings.
 * @param {number} axis - The alignment axis: 0 (X), 1 (Y) or 2 (Z).
 * @returns {object} The settings to build.
 */
function alignToAxis(world, settings, axis) {
    if (axis !== 0 && axis !== 2) {
        return settings;
    }

    const Jolt = world._jolt;
    const vec = world._vec;
    const quat = world._quat;
    vec.Set(0, 0, 0);
    if (axis === 0) {
        // -90 degrees about Z takes +Y to +X
        quat.Set(0, 0, -SQRT_HALF, SQRT_HALF);
    } else {
        // 90 degrees about X takes +Y to +Z
        quat.Set(SQRT_HALF, 0, 0, SQRT_HALF);
    }
    return new Jolt.RotatedTranslatedShapeSettings(vec, quat, settings);
}

/**
 * Returns the cached triangle mesh for a source, building it on first use. The cache is keyed by
 * the source id, so sources sharing geometry share one unit scale MeshShape, and each instance
 * applies its own scale by wrapping it (see createMeshInstance). Source data accessors are only
 * read on a cache miss.
 *
 * Duplicate vertices are welded when the source asks for it: Jolt finds the edges triangles
 * share from shared vertex indices, and uses them to keep bodies sliding across a mesh from
 * catching on its internal edges.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @returns {JoltMeshEntry} The cache entry.
 */
function getMesh(world, source) {
    let entry = world._meshCache.get(source.id);
    if (entry) {
        return entry;
    }

    const Jolt = world._jolt;
    const layout = world._layout;
    const positions = source.positions;
    const stride = source.stride;
    const indices = source.indices;
    const base = source.base;
    const count = source.count;

    // assign each vertex a welded index on first use
    let maxIndex = 0;
    for (let i = 0; i < count; i++) {
        maxIndex = Math.max(maxIndex, indices[base + i]);
    }
    const welded = new Int32Array(maxIndex + 1).fill(-1);
    const byPosition = source.checkDuplicates ? new Map() : null;
    const vertices = [];
    const triangles = new Uint32Array(count);
    let numVertices = 0;

    for (let i = 0; i < count; i++) {
        const index = indices[base + i];
        let w = welded[index];
        if (w < 0) {
            const x = positions[index * stride];
            const y = positions[index * stride + 1];
            const z = positions[index * stride + 2];
            if (byPosition) {
                const key = `${x}:${y}:${z}`;
                w = byPosition.get(key) ?? -1;
                if (w < 0) {
                    w = numVertices++;
                    byPosition.set(key, w);
                    vertices.push(x, y, z);
                }
            } else {
                w = numVertices++;
                vertices.push(x, y, z);
            }
            welded[index] = w;
        }
        triangles[i] = w;
    }

    const settings = new Jolt.MeshShapeSettings();
    const vertexList = settings.mTriangleVertices;
    const triangleList = settings.mIndexedTriangles;
    const numTriangles = Math.floor(count / 3);
    vertexList.resize(numVertices);
    triangleList.resize(numTriangles);

    if (layout && numVertices > 0 && numTriangles > 0) {
        // write straight into the lists
        const heap = Jolt.HEAPF32;
        const words = Jolt.HEAPU32;
        let v = Jolt.getPointer(vertexList.at(0)) >> 2;
        for (let i = 0; i < numVertices; i++, v += layout.vertexStride) {
            heap[v] = vertices[i * 3];
            heap[v + 1] = vertices[i * 3 + 1];
            heap[v + 2] = vertices[i * 3 + 2];
        }
        let t = (Jolt.getPointer(triangleList.at(0)) >> 2) + layout.triangleIndices;
        for (let i = 0; i < numTriangles; i++, t += layout.triangleStride) {
            words[t] = triangles[i * 3];
            words[t + 1] = triangles[i * 3 + 1];
            words[t + 2] = triangles[i * 3 + 2];
        }
    } else {
        for (let i = 0; i < numVertices; i++) {
            const vertex = vertexList.at(i);
            vertex.x = vertices[i * 3];
            vertex.y = vertices[i * 3 + 1];
            vertex.z = vertices[i * 3 + 2];
        }
        for (let i = 0; i < numTriangles; i++) {
            const triangle = triangleList.at(i);
            triangle.set_mIdx(0, triangles[i * 3]);
            triangle.set_mIdx(1, triangles[i * 3 + 1]);
            triangle.set_mIdx(2, triangles[i * 3 + 2]);
        }
    }

    // drops degenerate and duplicate triangles
    settings.Sanitize();

    entry = { id: source.id, shape: build(world, settings, 'triangle mesh'), refCount: 0 };
    world._meshCache.set(source.id, entry);
    return entry;
}

/**
 * Returns an instance of a source's cached triangle mesh at the source scale. Scaled instances
 * wrap the shared unit scale mesh, so every instance of a mesh shares its triangle data and
 * bounding volume tree whatever its scale, negative scales included.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @param {JoltMeshEntry[]} entries - Receives the cache entry used.
 * @returns {object} The instance, referenced once.
 */
function createMeshInstance(world, source, entries) {
    const entry = getMesh(world, source);
    entry.refCount++;
    entries.push(entry);

    const scale = source.scale;
    if (isUnitScale(scale)) {
        entry.shape.AddRef();
        return entry.shape;
    }

    const vec = world._vec;
    vec.Set(scale.x, scale.y, scale.z);
    const result = entry.shape.ScaleShape(vec);
    if (result.HasError()) {
        Debug.warnOnce('JoltPhysicsWorld: cannot scale a mesh collider by ' +
            `(${scale.x}, ${scale.y}, ${scale.z}) (${result.GetError().c_str()}). It collides ` +
            'as an empty shape.');
        result.Clear();
        return createEmptyShape(world);
    }

    const instance = result.Get();
    instance.AddRef();
    // the result is a temporary shared by all calls, which would hold the instance until the next
    result.Clear();
    return instance;
}

/**
 * Creates the settings of a convex hull around a source's vertices, with the source scale baked
 * into the points.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsMeshSource} source - The geometry source.
 * @returns {object} The convex hull settings.
 */
function createHullSettings(world, source) {
    const Jolt = world._jolt;
    const layout = world._layout;
    const positions = source.positions;
    const stride = source.stride;
    const scale = source.scale;
    const sx = scale ? scale.x : 1;
    const sy = scale ? scale.y : 1;
    const sz = scale ? scale.z : 1;
    const numPoints = Math.floor(positions.length / stride);

    const settings = new Jolt.ConvexHullShapeSettings();
    const points = settings.mPoints;
    points.resize(numPoints);

    if (layout && numPoints > 0) {
        const heap = Jolt.HEAPF32;
        let p = Jolt.getPointer(points.at(0)) >> 2;
        for (let i = 0; i < numPoints; i++, p += layout.pointStride) {
            heap[p] = positions[i * stride] * sx;
            heap[p + 1] = positions[i * stride + 1] * sy;
            heap[p + 2] = positions[i * stride + 2] * sz;
        }
    } else {
        for (let i = 0; i < numPoints; i++) {
            const j = i * stride;
            points.at(i).Set(positions[j] * sx, positions[j + 1] * sy, positions[j + 2] * sz);
        }
    }

    return settings;
}

/**
 * Returns whether a mesh source sits at the origin of its mesh shape.
 *
 * @param {PhysicsMeshSource} source - The geometry source.
 * @returns {boolean} True if the source pose is the identity.
 */
function isIdentityPose(source) {
    const p = source.position;
    const r = source.rotation;
    return p.x === 0 && p.y === 0 && p.z === 0 && r.x === 0 && r.y === 0 && r.z === 0 && r.w === 1;
}

/**
 * Per-type shape creation. Sizes use engine conventions (full heights) and are converted to Jolt
 * conventions here. Each returns a shape referenced once, owned by the handle.
 *
 * @type {Object<string, JoltShapeFactory>}
 */
const shapeFactories = {
    box: (world, desc) => {
        const he = desc.halfExtents;
        const vec = world._vec;
        vec.Set(he.x, he.y, he.z);
        const radius = Math.max(0, Math.min(CONVEX_RADIUS, he.x, he.y, he.z));
        return build(world, new world._jolt.BoxShapeSettings(vec, radius), 'box');
    },

    sphere: (world, desc) => {
        return build(world, new world._jolt.SphereShapeSettings(desc.radius), 'sphere');
    },

    capsule: (world, desc) => {
        const radius = desc.radius;
        const halfHeight = Math.max(desc.height - 2 * radius, 0) * 0.5;
        const settings = new world._jolt.CapsuleShapeSettings(halfHeight, radius);
        return build(world, alignToAxis(world, settings, desc.axis), 'capsule');
    },

    cylinder: (world, desc) => {
        const radius = desc.radius;
        const halfHeight = desc.height * 0.5;
        const convexRadius = Math.max(0, Math.min(CONVEX_RADIUS, radius, halfHeight));
        const settings = new world._jolt.CylinderShapeSettings(halfHeight, radius, convexRadius);
        return build(world, alignToAxis(world, settings, desc.axis), 'cylinder');
    },

    cone: (world, desc) => {
        // a tapered cylinder with a point at the top: the apex is at +height / 2 along the axis,
        // as in Bullet. The sharp apex allows no convex radius
        const radius = desc.radius;
        const halfHeight = desc.height * 0.5;
        const settings = new world._jolt.TaperedCylinderShapeSettings(halfHeight, 0, radius, 0);
        return build(world, alignToAxis(world, settings, desc.axis), 'cone');
    },

    mesh: (world, desc, entries) => {
        const Jolt = world._jolt;
        const sources = desc.sources;

        const vec = world._vec;
        const quat = world._quat;

        // a single source at the origin needs no compound around it
        if (sources.length === 1 && isIdentityPose(sources[0])) {
            const source = sources[0];
            if (source.convexHull) {
                return build(world, createHullSettings(world, source), 'convex hull');
            }

            const instance = createMeshInstance(world, source, entries);
            if (instance !== entries[0].shape) {
                return instance;
            }

            // unless it is the shared unit scale mesh itself: a handle must be a shape of its
            // own. Jolt reduces a static compound of one part at the origin to the part itself,
            // so the wrapper is a mutable compound
            const wrapper = new Jolt.MutableCompoundShapeSettings();
            vec.Set(0, 0, 0);
            quat.Set(0, 0, 0, 1);
            wrapper.AddShapeShape(vec, quat, instance, 0);
            instance.Release();
            return build(world, wrapper, 'mesh');
        }

        const compound = new Jolt.StaticCompoundShapeSettings();
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const p = source.position;
            const r = source.rotation;
            if (source.convexHull) {
                const hull = createHullSettings(world, source);
                vec.Set(p.x, p.y, p.z);
                quat.Set(r.x, r.y, r.z, r.w);
                compound.AddShape(vec, quat, hull, 0);
            } else {
                const instance = createMeshInstance(world, source, entries);
                vec.Set(p.x, p.y, p.z);
                quat.Set(r.x, r.y, r.z, r.w);
                compound.AddShapeShape(vec, quat, instance, 0);
                // the compound settings hold their own reference
                instance.Release();
            }
        }

        return build(world, compound, 'mesh');
    },

    compound: (world, desc) => {
        // built empty, so its center of mass is at its origin and stays there as children are
        // added, as in Bullet; children are placed by their origin
        const Jolt = world._jolt;
        const shape = build(world, new Jolt.MutableCompoundShapeSettings(), 'compound');
        return Jolt.castObject(shape, Jolt.MutableCompoundShape);
    }
};

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {PhysicsShapeDesc} desc - The shape descriptor.
 * @returns {object} The shape handle: the native Jolt shape, referenced by the world until
 * destroyShape. Compound handles are MutableCompoundShape wrappers.
 */
function createShape(world, desc) {
    const factory = shapeFactories[desc.type];
    Debug.assert(factory, `JoltPhysicsWorld#createShape: invalid shape type: ${desc.type}`);

    const entries = [];
    const shape = factory(world, desc, entries);

    // a wrapper may be reused from a freed shape at the same address, so every field is set
    shape._shapeType = desc.type;
    shape._meshEntries = entries.length ? entries : null;
    shape._children = desc.type === 'compound' ? [] : null;
    shape._bodies = desc.type === 'compound' ? new Set() : null;

    world._shapes.add(shape);
    return shape;
}

/**
 * Releases the world's reference to a shape. Bodies and compounds still using it keep it alive.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} shape - The shape handle.
 */
function destroyShape(world, shape) {
    world._shapes.delete(shape);
    world._dirtyCompounds.delete(shape);

    // drop the references the shape held on the shared triangle meshes - the ones left
    // unreferenced are released at the end of the step
    const entries = shape._meshEntries;
    if (entries) {
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (--entry.refCount === 0) {
                world._unusedMeshes.add(entry);
            }
        }
        shape._meshEntries = null;
    }

    // the native compound references its children until it is freed; the children are owned by
    // other components
    shape._children = null;
    shape._bodies = null;

    if (shape.GetRefCount() === 1) {
        uncache(world._jolt, shape);
    }
    shape.Release();
}

/**
 * Releases the cached triangle meshes no collider uses any more. Runs at the end of a physics
 * step rather than when the last user goes, so a collider rebuilt within a frame (after a
 * rescale, say) keeps the mesh it is about to use again.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 */
function releaseUnusedMeshes(world) {
    const entries = world._unusedMeshes;
    if (entries.size === 0) return;

    entries.forEach((entry) => {
        if (entry.refCount === 0) {
            world._meshCache.delete(entry.id);
            entry.shape.Release();
        }
    });
    entries.clear();
}

/**
 * Marks a compound as changed, so the bodies using it are updated before the next step or
 * query.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} compound - The compound handle.
 */
function markChanged(world, compound) {
    world._dirtyCompounds.add(compound);
}

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} compound - The compound handle.
 * @param {object} child - The child shape handle.
 * @param {Vec3} position - The child position in the compound's local space.
 * @param {Quat} rotation - The child rotation in the compound's local space.
 */
function addCompoundChild(world, compound, child, position, rotation) {
    const vec = world._vec;
    const quat = world._quat;
    vec.Set(position.x, position.y, position.z);
    quat.Set(rotation.x, rotation.y, rotation.z, rotation.w);
    compound.AddShape(vec, quat, child, 0);
    compound._children.push(child);
    markChanged(world, compound);
}

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} compound - The compound handle.
 * @param {object} child - The child shape handle.
 * @param {Vec3} position - The child position in the compound's local space.
 * @param {Quat} rotation - The child rotation in the compound's local space.
 */
function updateCompoundChild(world, compound, child, position, rotation) {
    const index = compound._children.indexOf(child);
    if (index < 0) {
        addCompoundChild(world, compound, child, position, rotation);
        return;
    }

    const vec = world._vec;
    const quat = world._quat;
    vec.Set(position.x, position.y, position.z);
    quat.Set(rotation.x, rotation.y, rotation.z, rotation.w);
    compound.ModifyShape(index, vec, quat);
    markChanged(world, compound);
}

/**
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} compound - The compound handle.
 * @param {object} child - The child shape handle.
 */
function removeCompoundChild(world, compound, child) {
    const children = compound._children;
    const index = children ? children.indexOf(child) : -1;
    if (index >= 0) {
        compound.RemoveShape(index);
        children.splice(index, 1);
        markChanged(world, compound);
    }
}

/**
 * Updates the bounds, and for dynamic bodies the mass properties, of the bodies whose compound
 * shapes changed since the last call. The center of mass of a compound stays at its origin, so
 * the bodies do not move.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 */
function flushShapeChanges(world) {
    const compounds = world._dirtyCompounds;
    if (compounds.size === 0) return;

    const Jolt = world._jolt;
    const bodyInterface = world._bodyInterface;
    const vec = world._vec;
    compounds.forEach((compound) => {
        compound._bodies?.forEach((body) => {
            vec.Set(0, 0, 0);
            bodyInterface.NotifyShapeChanged(body._id, vec, false, Jolt.EActivation_DontActivate);
            body._updateMassProperties();
        });
    });
    compounds.clear();
}

/**
 * Returns the mass properties of a shape scaled to a mass, in a temporary shared by all calls.
 * Shapes without volume (triangle meshes, flat hulls, empty compounds) have no mass properties
 * of their own, so the inertia of the box bounding the shape stands in, the approximation
 * Bullet uses for every compound shape.
 *
 * @param {JoltPhysicsWorld} world - The owning world.
 * @param {object} shape - The shape handle.
 * @param {number} mass - The mass, or 0 to leave the properties unscaled.
 * @returns {object} The mass properties, valid until the next call.
 */
function computeMassProperties(world, shape, mass) {
    const props = shape.GetMassProperties();
    if (!(props.mMass > 0)) {
        const size = shape.GetLocalBounds().GetSize();
        const vec = world._vec;
        vec.Set(
            Math.max(size.GetX(), MIN_INERTIA_EXTENT),
            Math.max(size.GetY(), MIN_INERTIA_EXTENT),
            Math.max(size.GetZ(), MIN_INERTIA_EXTENT)
        );
        props.SetMassAndInertiaOfSolidBox(vec, 1);
    }
    if (mass > 0) {
        props.ScaleToMass(mass);
    }
    return props;
}

export {
    createShape, destroyShape, releaseUnusedMeshes, addCompoundChild, updateCompoundChild,
    removeCompoundChild, flushShapeChanges, computeMassProperties
};
