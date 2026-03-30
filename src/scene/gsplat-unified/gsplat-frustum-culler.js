import { Frustum } from '../../core/shape/frustum.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { PIXELFORMAT_R32U, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';
import { GSplatNodeCullRenderPass } from './gsplat-node-cull-render-pass.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatInfo } from "./gsplat-info.js"
 */

const tmpSize = new Vec2();
const _viewProjMat = new Mat4();
const _frustum = new Frustum();
const _frustumPlanes = new Float32Array(24);

/**
 * GPU frustum culling for GSplat octree nodes. Manages bounding-sphere and transform
 * textures, runs a render-pass that tests each sphere against camera frustum planes,
 * and produces a bit-packed visibility texture consumed by interval compaction.
 *
 * @ignore
 */
class GSplatFrustumCuller {
    /** @type {GraphicsDevice} */
    device;

    /**
     * RGBA32F texture storing local-space bounding spheres for all selected nodes
     * across all GSplatInfos. Each texel is (center.x, center.y, center.z, radius).
     * Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    boundsSphereTexture = null;

    /**
     * R32U texture mapping each bounds entry to its GSplatInfo index (for transform lookup).
     * Same dimensions as boundsSphereTexture. Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    boundsTransformIndexTexture = null;

    /**
     * R32U texture storing per-node visibility as packed bitmasks.
     * Each texel packs 32 visibility bits, so width is boundsSphereTexture.width / 32.
     * Written by the culling render pass.
     *
     * @type {Texture|null}
     */
    nodeVisibilityTexture = null;

    /**
     * Render target wrapping nodeVisibilityTexture for the culling pass.
     *
     * @type {RenderTarget|null}
     */
    cullingRenderTarget = null;

    /**
     * GPU frustum culling render pass. Created lazily on first use.
     *
     * @type {GSplatNodeCullRenderPass|null}
     */
    cullingPass = null;

    /**
     * Total number of bounds entries across all GSplatInfos.
     *
     * @type {number}
     */
    totalBoundsEntries = 0;

    /**
     * RGBA32F texture storing world matrices (3 texels per GSplatInfo, rows of a 4x3
     * affine matrix) for transforming local bounding spheres to world space during
     * GPU frustum culling.
     * Created lazily on first use and resized as needed.
     *
     * @type {Texture|null}
     */
    transformsTexture = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;
    }

    destroy() {
        this.boundsSphereTexture?.destroy();
        this.boundsTransformIndexTexture?.destroy();
        this.nodeVisibilityTexture?.destroy();
        this.cullingRenderTarget?.destroy();
        this.cullingPass?.destroy();
        this.transformsTexture?.destroy();
    }

    /**
     * Updates the bounds sphere texture with local-space bounding spheres from pre-built
     * bounds groups. Each group contributes one set of sphere entries and maps to one
     * transform index.
     *
     * @param {Array<{splat: GSplatInfo, boundsBaseIndex: number, numBoundsEntries: number}>} boundsGroups - Pre-built bounds groups.
     */
    updateBoundsTexture(boundsGroups) {
        let totalEntries = 0;
        for (let i = 0; i < boundsGroups.length; i++) {
            totalEntries += boundsGroups[i].numBoundsEntries;
        }

        this.totalBoundsEntries = totalEntries;

        if (totalEntries === 0) return;

        // Width is multiple of 32 so that 32 consecutive spheres always land on the same
        // texture row, allowing the bit-packed culling shader to avoid per-iteration modulo/division.
        const { x: width, y: height } = TextureUtils.calcTextureSize(totalEntries, tmpSize, 32);

        // Create/resize bounds sphere texture (RGBA32F: center.xyz, radius)
        if (!this.boundsSphereTexture) {
            this.boundsSphereTexture = Texture.createDataTexture2D(this.device, 'boundsSphereTexture', width, height, PIXELFORMAT_RGBA32F);
        } else {
            this.boundsSphereTexture.resize(width, height);
        }

        // Create/resize transform index texture (R32U: group index per bounds entry)
        if (!this.boundsTransformIndexTexture) {
            this.boundsTransformIndexTexture = Texture.createDataTexture2D(this.device, 'boundsTransformIndexTexture', width, height, PIXELFORMAT_R32U);
        } else {
            this.boundsTransformIndexTexture.resize(width, height);
        }

        const sphereData = this.boundsSphereTexture.lock();
        const indexData = /** @type {Uint32Array} */ (this.boundsTransformIndexTexture.lock());

        for (let i = 0; i < boundsGroups.length; i++) {
            const group = boundsGroups[i];
            const base = group.boundsBaseIndex;
            const count = group.numBoundsEntries;

            group.splat.writeBoundsSpheres(sphereData, base * 4);

            for (let j = 0; j < count; j++) {
                indexData[base + j] = i;
            }
        }

        this.boundsSphereTexture.unlock();
        this.boundsTransformIndexTexture.unlock();
    }

    /**
     * Updates the transforms texture with one world matrix per bounds group.
     * Each matrix uses 3 texels (RGBA32F per row) in the texture.
     *
     * @param {Array<{splat: GSplatInfo, boundsBaseIndex: number, numBoundsEntries: number}>} boundsGroups - Pre-built bounds groups.
     */
    updateTransformsTexture(boundsGroups) {
        const numMatrices = boundsGroups.length;
        if (numMatrices === 0) return;

        // 3 texels per matrix (rows of a 4x3 affine matrix). Width is a multiple of 3 so all 3
        // texels of a matrix always land on the same texture row.
        const totalTexels = numMatrices * 3;
        const { x: width, y: height } = TextureUtils.calcTextureSize(totalTexels, tmpSize, 3);

        if (!this.transformsTexture) {
            this.transformsTexture = Texture.createDataTexture2D(this.device, 'transformsTexture', width, height, PIXELFORMAT_RGBA32F);
        } else {
            this.transformsTexture.resize(width, height);
        }

        const data = this.transformsTexture.lock();

        // Write world matrices as 3 rows of a 4x3 matrix (row-major, 12 floats per matrix).
        // Mat4.data is column-major: [col0(4), col1(4), col2(4), col3(4)].
        // We store 3 rows, each as (Rx, Ry, Rz, T):
        //   row0 = data[0], data[4], data[8],  data[12]
        //   row1 = data[1], data[5], data[9],  data[13]
        //   row2 = data[2], data[6], data[10], data[14]
        // The shader reconstructs the mat4 by transposing + appending (0,0,0,1).
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

        this.transformsTexture.unlock();
    }

    /**
     * Runs the GPU frustum culling pass to generate the node visibility texture.
     * Computes the view-projection matrix, extracts frustum planes, and tests each
     * bounding sphere against them.
     *
     * @param {Mat4} projectionMatrix - The camera projection matrix.
     * @param {Mat4} viewMatrix - The camera view matrix.
     */
    updateNodeVisibility(projectionMatrix, viewMatrix) {
        if (this.totalBoundsEntries === 0 || !this.boundsSphereTexture || !this.boundsTransformIndexTexture || !this.transformsTexture) {
            return;
        }

        // Compute view-projection matrix and extract frustum planes
        _viewProjMat.mul2(projectionMatrix, viewMatrix);
        _frustum.setFromMat4(_viewProjMat);
        for (let p = 0; p < 6; p++) {
            const plane = _frustum.planes[p];
            _frustumPlanes[p * 4 + 0] = plane.normal.x;
            _frustumPlanes[p * 4 + 1] = plane.normal.y;
            _frustumPlanes[p * 4 + 2] = plane.normal.z;
            _frustumPlanes[p * 4 + 3] = plane.distance;
        }

        // Visibility texture is 32x smaller: each texel stores 32 sphere results as bits.
        // Since boundsTextureWidth is a multiple of 32, the visibility texture is exactly
        // (boundsWidth/32) x boundsHeight, keeping a 1:1 row correspondence and allowing
        // the shader to derive visWidth = boundsTextureWidth / 32 without extra uniforms.
        const width = this.boundsSphereTexture.width / 32;
        const height = this.boundsSphereTexture.height;

        // Create/resize visibility texture (R32U: bit-packed, 32 spheres per texel)
        if (!this.nodeVisibilityTexture) {
            this.nodeVisibilityTexture = Texture.createDataTexture2D(this.device, 'nodeVisibilityTexture', width, height, PIXELFORMAT_R32U);

            this.cullingRenderTarget = new RenderTarget({
                name: 'NodeCullingRT',
                colorBuffer: this.nodeVisibilityTexture,
                depth: false
            });
        } else if (this.nodeVisibilityTexture.width !== width || this.nodeVisibilityTexture.height !== height) {
            this.nodeVisibilityTexture.resize(width, height);
            /** @type {RenderTarget} */ (this.cullingRenderTarget).resize(width, height);
        }

        // Lazily create the culling render pass
        if (!this.cullingPass) {
            this.cullingPass = new GSplatNodeCullRenderPass(this.device);
            this.cullingPass.init(this.cullingRenderTarget);
            this.cullingPass.colorOps.clear = true;
            this.cullingPass.colorOps.clearValue.set(0, 0, 0, 0);
        }

        // Set up uniforms and execute
        this.cullingPass.setup(
            this.boundsSphereTexture,
            this.boundsTransformIndexTexture,
            this.transformsTexture,
            this.totalBoundsEntries,
            _frustumPlanes
        );

        this.cullingPass.render();
    }
}

export { GSplatFrustumCuller };
