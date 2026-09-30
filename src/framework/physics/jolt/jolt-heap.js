/**
 * Offsets, in 4 byte words, of the Jolt data the backend reads and writes straight through the
 * module heap rather than through the bindings, which cost a call into the module per value. They
 * are located when a world is created, by writing known values through the bindings and finding
 * them in memory, so they follow the layout of the build in use instead of being hard coded.
 *
 * @typedef {object} JoltHeapLayout
 * @property {number} bodyPosition - Body: world space position of the center of mass (3 floats).
 * @property {number} bodyRotation - Body: world space rotation (4 floats).
 * @property {number} linearVelocity - MotionProperties: linear velocity (3 floats).
 * @property {number} angularVelocity - MotionProperties: angular velocity (3 floats).
 * @property {number} manifoldBaseOffset - ContactManifold: the offset contact points are relative
 * to (3 floats).
 * @property {number} manifoldNormal - ContactManifold: world space normal (3 floats).
 * @property {number} manifoldSubShape1 - ContactManifold: sub shape ID on body 1 (uint32).
 * @property {number} manifoldSubShape2 - ContactManifold: sub shape ID on body 2 (uint32).
 * @property {number} manifoldCount - ContactManifold: number of points on body 1 (uint32).
 * @property {number} manifoldPoints1 - ContactManifold: first point on body 1 (3 floats).
 * @property {number} manifoldPoints2 - ContactManifold: first point on body 2 (3 floats).
 * @property {number} pointStride - Words between consecutive contact points and hull points.
 * @property {number} vertexStride - Words between consecutive mesh vertices (Float3).
 * @property {number} triangleStride - Words between consecutive indexed triangles.
 * @property {number} triangleIndices - Offset of the three vertex indices of a triangle.
 * @ignore
 */

// Unlikely values to write through the bindings and search for, each exactly representable as a
// 32 bit float
const PROBE_A = [1.25, -2.5, 3.75];
const PROBE_B = [-4.5, 5.25, -6.125];
const PROBE_C = [0.1875, -0.3125, 0.5625];
const PROBE_D = [0.4375, 0.0625, -0.8125];
const ROTATION_A = [0.5, -0.5, 0.5, 0.5];
const ROTATION_B = [-0.5, 0.5, 0.5, 0.5];

// how far past an object's address to search for a member, in words
const SEARCH_WORDS = 96;

/**
 * Returns the offset from base at which the float values are stored consecutively, or -1.
 *
 * @param {Float32Array} heap - The module's float view.
 * @param {number} base - The word address to search from.
 * @param {number[]} values - The values to find.
 * @returns {number} The offset in words, or -1.
 */
function findFloats(heap, base, values) {
    for (let i = 0; i < SEARCH_WORDS; i++) {
        let match = true;
        for (let j = 0; j < values.length && match; j++) {
            match = heap[base + i + j] === Math.fround(values[j]);
        }
        if (match) {
            return i;
        }
    }
    return -1;
}

/**
 * Returns whether the floats stored at a word address are the given values.
 *
 * @param {Float32Array} heap - The module's float view.
 * @param {number} address - The word address.
 * @param {number[]} values - The expected values.
 * @returns {boolean} True if they match.
 */
function floatsAt(heap, address, values) {
    for (let i = 0; i < values.length; i++) {
        if (heap[address + i] !== Math.fround(values[i])) {
            return false;
        }
    }
    return true;
}

/**
 * Locates the body and motion members: writes a pose and velocities to a temporary body, finds
 * them, then writes a second set and checks they land at the same offsets.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {object} bodyInterface - The world's body interface.
 * @param {object} layout - The layout to fill.
 * @returns {boolean} True if every member was found and verified.
 */
function probeBody(Jolt, bodyInterface, layout) {
    const shapeSettings = new Jolt.SphereShapeSettings(0.5);
    const shape = shapeSettings.Create().Get();
    shape.AddRef();
    Jolt.destroy(shapeSettings);

    const position = new Jolt.RVec3(PROBE_A[0], PROBE_A[1], PROBE_A[2]);
    const rotation = new Jolt.Quat(ROTATION_A[0], ROTATION_A[1], ROTATION_A[2], ROTATION_A[3]);
    const settings = new Jolt.BodyCreationSettings(shape, position, rotation,
        Jolt.EMotionType_Dynamic, 0);
    const body = bodyInterface.CreateBody(settings);
    Jolt.destroy(settings);

    let ok = false;
    if (body) {
        const vector = new Jolt.Vec3(PROBE_C[0], PROBE_C[1], PROBE_C[2]);
        body.SetLinearVelocity(vector);
        vector.Set(PROBE_D[0], PROBE_D[1], PROBE_D[2]);
        body.SetAngularVelocity(vector);

        const heap = Jolt.HEAPF32;
        const bodyBase = Jolt.getPointer(body) >> 2;
        const motionBase = Jolt.getPointer(body.GetMotionProperties()) >> 2;

        layout.bodyPosition = findFloats(heap, bodyBase, PROBE_A);
        layout.bodyRotation = findFloats(heap, bodyBase, ROTATION_A);
        layout.linearVelocity = findFloats(heap, motionBase, PROBE_C);
        layout.angularVelocity = findFloats(heap, motionBase, PROBE_D);

        if (layout.bodyPosition >= 0 && layout.bodyRotation >= 0 &&
            layout.linearVelocity >= 0 && layout.angularVelocity >= 0) {
            // move everything and check the same offsets see the new values
            position.Set(PROBE_B[0], PROBE_B[1], PROBE_B[2]);
            rotation.Set(ROTATION_B[0], ROTATION_B[1], ROTATION_B[2], ROTATION_B[3]);
            bodyInterface.SetPositionAndRotation(body.GetID(), position, rotation,
                Jolt.EActivation_DontActivate);
            vector.Set(PROBE_D[0], PROBE_D[1], PROBE_D[2]);
            body.SetLinearVelocity(vector);
            vector.Set(PROBE_C[0], PROBE_C[1], PROBE_C[2]);
            body.SetAngularVelocity(vector);

            ok = floatsAt(heap, bodyBase + layout.bodyPosition, PROBE_B) &&
                floatsAt(heap, bodyBase + layout.bodyRotation, ROTATION_B) &&
                floatsAt(heap, motionBase + layout.linearVelocity, PROBE_D) &&
                floatsAt(heap, motionBase + layout.angularVelocity, PROBE_C);
        }

        Jolt.destroy(vector);
        bodyInterface.DestroyBody(body.GetID());
    }

    Jolt.destroy(position);
    Jolt.destroy(rotation);
    shape.Release();

    return ok;
}

/**
 * Locates the contact manifold members from the addresses its attribute accessors return, which
 * point into the manifold, and checks them with values written through the bindings.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {object} layout - The layout to fill.
 * @returns {boolean} True if every member was found and verified.
 */
function probeManifold(Jolt, layout) {
    const manifold = new Jolt.ContactManifold();
    const base = Jolt.getPointer(manifold);
    const vector = new Jolt.Vec3(PROBE_A[0], PROBE_A[1], PROBE_A[2]);
    const offset = new Jolt.RVec3(PROBE_B[0], PROBE_B[1], PROBE_B[2]);

    manifold.mBaseOffset = offset;
    manifold.mWorldSpaceNormal = vector;
    manifold.mSubShapeID1.SetValue(0x12345678);
    manifold.mSubShapeID2.SetValue(0x0abcdef0);

    const points1 = manifold.mRelativeContactPointsOn1;
    const points2 = manifold.mRelativeContactPointsOn2;
    points1.push_back(vector);
    vector.Set(PROBE_C[0], PROBE_C[1], PROBE_C[2]);
    points1.push_back(vector);
    vector.Set(PROBE_D[0], PROBE_D[1], PROBE_D[2]);
    points2.push_back(vector);

    layout.manifoldBaseOffset = (Jolt.getPointer(manifold.mBaseOffset) - base) >> 2;
    layout.manifoldNormal = (Jolt.getPointer(manifold.mWorldSpaceNormal) - base) >> 2;
    layout.manifoldSubShape1 = (Jolt.getPointer(manifold.mSubShapeID1) - base) >> 2;
    layout.manifoldSubShape2 = (Jolt.getPointer(manifold.mSubShapeID2) - base) >> 2;
    layout.manifoldCount = (Jolt.getPointer(points1) - base) >> 2;
    layout.manifoldPoints1 = (Jolt.getPointer(points1.at(0)) - base) >> 2;
    layout.manifoldPoints2 = (Jolt.getPointer(points2.at(0)) - base) >> 2;
    layout.pointStride = (Jolt.getPointer(points1.at(1)) - Jolt.getPointer(points1.at(0))) >> 2;

    const heap = Jolt.HEAPF32;
    const words = Jolt.HEAPU32;
    const b = base >> 2;
    const ok = floatsAt(heap, b + layout.manifoldBaseOffset, PROBE_B) &&
        floatsAt(heap, b + layout.manifoldNormal, PROBE_A) &&
        words[b + layout.manifoldSubShape1] === 0x12345678 &&
        words[b + layout.manifoldSubShape2] === 0x0abcdef0 &&
        words[b + layout.manifoldCount] === 2 &&
        floatsAt(heap, b + layout.manifoldPoints1, PROBE_A) &&
        floatsAt(heap, b + layout.manifoldPoints1 + layout.pointStride, PROBE_C) &&
        floatsAt(heap, b + layout.manifoldPoints2, PROBE_D);

    Jolt.destroy(offset);
    Jolt.destroy(vector);
    Jolt.destroy(manifold);

    return ok;
}

/**
 * Locates the elements of the vertex, triangle and point lists that mesh and convex hull shapes
 * are built from, so their data can be written in bulk.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {object} layout - The layout to fill.
 * @returns {boolean} True if every member was found and verified.
 */
function probeGeometry(Jolt, layout) {
    const vertices = new Jolt.VertexList();
    vertices.resize(2);
    const v1 = vertices.at(1);
    v1.x = PROBE_A[0];
    v1.y = PROBE_A[1];
    v1.z = PROBE_A[2];
    const v0 = Jolt.getPointer(vertices.at(0)) >> 2;
    layout.vertexStride = (Jolt.getPointer(v1) >> 2) - v0;

    const triangles = new Jolt.IndexedTriangleList();
    triangles.resize(2);
    const t1 = triangles.at(1);
    t1.set_mIdx(0, 0x01020304);
    t1.set_mIdx(1, 0x05060708);
    t1.set_mIdx(2, 0x090a0b0c);
    const t0 = Jolt.getPointer(triangles.at(0)) >> 2;
    const t1Address = Jolt.getPointer(t1) >> 2;
    layout.triangleStride = t1Address - t0;

    const words = Jolt.HEAPU32;
    layout.triangleIndices = -1;
    for (let i = 0; i < layout.triangleStride; i++) {
        if (words[t1Address + i] === 0x01020304 && words[t1Address + i + 1] === 0x05060708 &&
            words[t1Address + i + 2] === 0x090a0b0c) {
            layout.triangleIndices = i;
            break;
        }
    }

    const points = new Jolt.ArrayVec3();
    points.resize(2);
    const p1 = points.at(1);
    p1.Set(PROBE_B[0], PROBE_B[1], PROBE_B[2]);
    const hullStride = (Jolt.getPointer(p1) - Jolt.getPointer(points.at(0))) >> 2;

    const heap = Jolt.HEAPF32;
    const ok = layout.vertexStride >= 3 && floatsAt(heap, v0 + layout.vertexStride, PROBE_A) &&
        layout.triangleIndices >= 0 && hullStride === layout.pointStride &&
        floatsAt(heap, Jolt.getPointer(p1) >> 2, PROBE_B);

    Jolt.destroy(vertices);
    Jolt.destroy(triangles);
    Jolt.destroy(points);

    return ok;
}

/**
 * Locates the Jolt data the backend accesses through the module heap.
 *
 * @param {object} Jolt - The Jolt module.
 * @param {object} bodyInterface - The world's body interface.
 * @returns {JoltHeapLayout|null} The layout, or null when any member cannot be located, for
 * example on a double precision build. The backend then goes through the bindings throughout.
 * @ignore
 */
function probeHeapLayout(Jolt, bodyInterface) {
    if (!Jolt.HEAPF32 || !Jolt.HEAPU32) {
        return null;
    }

    const layout = /** @type {JoltHeapLayout} */ ({});
    const ok = probeBody(Jolt, bodyInterface, layout) && probeManifold(Jolt, layout) &&
        probeGeometry(Jolt, layout);
    return ok ? layout : null;
}

export { probeHeapLayout };
