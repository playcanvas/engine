import { Frustum } from '../../core/shape/frustum.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BUFFERUSAGE_COPY_DST } from '../../platform/graphics/constants.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatInfo } from "./gsplat-info.js"
 */

const _viewProjMat = new Mat4();
const _frustum = new Frustum();

// 8 u32/f32 elements per BoundsEntry (matches WGSL struct layout):
// [centerX, centerY, centerZ, radius, transformIndex, pad, pad, pad]
const BOUNDS_ENTRY_FLOATS = 8;

/**
 * Frustum culling data for GSplat octree nodes. Manages bounding-sphere and
 * transform storage buffers and computes frustum planes from camera matrices.
 * The actual culling test is performed inline by the interval compaction compute shader.
 *
 * @ignore
 */
class GSplatFrustumCuller {
    /** @type {GraphicsDevice} */
    device;

    /**
     * Storage buffer holding interleaved BoundsEntry structs (center.xyz, radius,
     * transformIndex, pad x3). 32 bytes per entry.
     *
     * @type {StorageBuffer|null}
     */
    boundsBuffer = null;

    /**
     * Total number of bounds entries across all GSplatInfos.
     */
    totalBoundsEntries = 0;

    /** @type {number} */
    _allocatedBoundsEntries = 0;

    /** @type {Float32Array|null} */
    _boundsFloatView = null;

    /** @type {Uint32Array|null} */
    _boundsUintView = null;

    /** @type {Float32Array|null} */
    _tmpSpheres = null;

    /**
     * Storage buffer holding world matrices as vec4f triplets (3 vec4f per matrix,
     * rows of a 4x3 affine matrix). 48 bytes per matrix.
     *
     * @type {StorageBuffer|null}
     */
    transformsBuffer = null;

    /** @type {number} */
    _allocatedTransformCount = 0;

    /** @type {Float32Array|null} */
    _transformsData = null;

    /**
     * Packed frustum planes (6 planes x 4 floats: nx, ny, nz, distance).
     * Updated by {@link computeFrustumPlanes} and consumed by the interval cull shader.
     *
     * @type {Float32Array}
     */
    frustumPlanes = new Float32Array(24);

    /**
     * Camera world position for fisheye cone culling (xyz).
     *
     * @type {Float32Array}
     */
    fisheyeCameraPos = new Float32Array(3);

    /**
     * Camera forward direction (normalized) for fisheye cone culling (xyz).
     *
     * @type {Float32Array}
     */
    fisheyeCameraForward = new Float32Array(3);

    /**
     * Maximum visible angle from forward direction for fisheye cone culling.
     */
    fisheyeMaxTheta = Math.PI;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;
    }

    destroy() {
        this.boundsBuffer?.destroy();
        this.transformsBuffer?.destroy();
    }

    /**
     * Updates the bounds buffer with local-space bounding spheres and transform
     * indices from pre-built bounds groups.
     *
     * @param {Array<{splat: GSplatInfo, boundsBaseIndex: number, numBoundsEntries: number}>} boundsGroups - Pre-built bounds groups.
     */
    updateBoundsData(boundsGroups) {
        let totalEntries = 0;
        for (let i = 0; i < boundsGroups.length; i++) {
            totalEntries += boundsGroups[i].numBoundsEntries;
        }

        this.totalBoundsEntries = totalEntries;

        if (totalEntries === 0) return;

        if (totalEntries > this._allocatedBoundsEntries) {
            this.boundsBuffer?.destroy();
            this._allocatedBoundsEntries = totalEntries;
            this.boundsBuffer = new StorageBuffer(this.device, totalEntries * BOUNDS_ENTRY_FLOATS * 4, BUFFERUSAGE_COPY_DST);

            const ab = new ArrayBuffer(totalEntries * BOUNDS_ENTRY_FLOATS * 4);
            this._boundsFloatView = new Float32Array(ab);
            this._boundsUintView = new Uint32Array(ab);
            this._tmpSpheres = new Float32Array(totalEntries * 4);
        }

        const floatView = this._boundsFloatView;
        const uintView = this._boundsUintView;
        const tmpSpheres = this._tmpSpheres;

        for (let i = 0; i < boundsGroups.length; i++) {
            const group = boundsGroups[i];
            const base = group.boundsBaseIndex;
            const count = group.numBoundsEntries;

            group.splat.writeBoundsSpheres(tmpSpheres, base * 4);

            for (let j = 0; j < count; j++) {
                const src = (base + j) * 4;
                const dst = (base + j) * BOUNDS_ENTRY_FLOATS;
                floatView[dst + 0] = tmpSpheres[src + 0];
                floatView[dst + 1] = tmpSpheres[src + 1];
                floatView[dst + 2] = tmpSpheres[src + 2];
                floatView[dst + 3] = tmpSpheres[src + 3];
                uintView[dst + 4] = i;
                // [dst+5..dst+7] are zero-initialized by ArrayBuffer
            }
        }

        this.boundsBuffer.write(0, floatView);
    }

    /**
     * Updates the transforms buffer with one world matrix per bounds group.
     * Each matrix is stored as 3 vec4f (rows of a 4x3 affine matrix).
     *
     * @param {Array<{splat: GSplatInfo, boundsBaseIndex: number, numBoundsEntries: number}>} boundsGroups - Pre-built bounds groups.
     */
    updateTransformsData(boundsGroups) {
        const numMatrices = boundsGroups.length;
        if (numMatrices === 0) return;

        if (numMatrices > this._allocatedTransformCount) {
            this.transformsBuffer?.destroy();
            this._allocatedTransformCount = numMatrices;
            // 3 vec4f per matrix = 12 floats = 48 bytes
            this.transformsBuffer = new StorageBuffer(this.device, numMatrices * 12 * 4, BUFFERUSAGE_COPY_DST);
            this._transformsData = new Float32Array(numMatrices * 12);
        }

        const data = this._transformsData;

        // Write world matrices as 3 rows of a 4x3 matrix (row-major, 12 floats per matrix).
        // Mat4.data is column-major: [col0(4), col1(4), col2(4), col3(4)].
        // We store 3 rows, each as (Rx, Ry, Rz, T):
        //   row0 = data[0], data[4], data[8],  data[12]
        //   row1 = data[1], data[5], data[9],  data[13]
        //   row2 = data[2], data[6], data[10], data[14]
        let offset = 0;
        for (let i = 0; i < boundsGroups.length; i++) {
            const m = boundsGroups[i].splat.node.getWorldTransform().data;
            // row 0
            data[offset++] = m[0]; data[offset++] = m[4]; data[offset++] = m[8]; data[offset++] = m[12];
            // row 1
            data[offset++] = m[1]; data[offset++] = m[5]; data[offset++] = m[9]; data[offset++] = m[13];
            // row 2
            data[offset++] = m[2]; data[offset++] = m[6]; data[offset++] = m[10]; data[offset++] = m[14];
        }

        this.transformsBuffer.write(0, data);
    }

    /**
     * Computes frustum planes from camera matrices and stores them in
     * {@link frustumPlanes} for use by the interval cull compute shader.
     *
     * @param {Mat4} projectionMatrix - The camera projection matrix.
     * @param {Mat4} viewMatrix - The camera view matrix.
     */
    computeFrustumPlanes(projectionMatrix, viewMatrix) {
        _viewProjMat.mul2(projectionMatrix, viewMatrix);
        _frustum.setFromMat4(_viewProjMat);
        const planes = this.frustumPlanes;
        for (let p = 0; p < 6; p++) {
            const plane = _frustum.planes[p];
            planes[p * 4 + 0] = plane.normal.x;
            planes[p * 4 + 1] = plane.normal.y;
            planes[p * 4 + 2] = plane.normal.z;
            planes[p * 4 + 3] = plane.distance;
        }
    }

    /**
     * Sets fisheye cone culling data for the interval cull shader.
     *
     * @param {import('../../core/math/vec3.js').Vec3} cameraPos - Camera world position.
     * @param {import('../../core/math/vec3.js').Vec3} cameraForward - Camera forward direction (normalized).
     * @param {number} maxTheta - Maximum visible angle from forward direction in radians.
     */
    setFisheyeData(cameraPos, cameraForward, maxTheta) {
        this.fisheyeCameraPos[0] = cameraPos.x;
        this.fisheyeCameraPos[1] = cameraPos.y;
        this.fisheyeCameraPos[2] = cameraPos.z;
        this.fisheyeCameraForward[0] = cameraForward.x;
        this.fisheyeCameraForward[1] = cameraForward.y;
        this.fisheyeCameraForward[2] = cameraForward.z;
        this.fisheyeMaxTheta = maxTheta;
    }
}

export { GSplatFrustumCuller };
