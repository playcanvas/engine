import { Debug } from '../../core/debug.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { PIXELFORMAT_RGBA32U } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';

/**
 * @import { GSplatInfo } from './gsplat-info.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

const _viewMat = new Mat4();
const _modelScale = new Vec3();
const _modelRotation = new Quat();
const _tmpSize = new Vec2();

const _whiteColor = [1, 1, 1];

/**
 * A render pass used to render multiple gsplats to a work buffer render target.
 *
 * @ignore
 */
class GSplatWorkBufferRenderPass extends RenderPass {
    /**
     * Array of GSplatInfo objects to render in this pass.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /** @type {number[][]|undefined} */
    colorsByLod = undefined;

    /**
     * The camera node used for rendering.
     *
     * @type {GraphNode}
     */
    cameraNode = /** @type {any} */ (null);

    /** @type {GSplatWorkBuffer} */
    workBuffer;

    /** @type {boolean} */
    colorOnly;

    /** @type {Float32Array} */
    _modelScaleData = new Float32Array(3);

    /** @type {Float32Array} */
    _modelRotationData = new Float32Array(4);

    /** @type {Int32Array} */
    _textureSize = new Int32Array(2);

    /**
     * Shared grow-only texture holding packed sub-draw data for all partial renders in a frame.
     *
     * @type {Texture}
     */
    _subDrawTexture;

    /**
     * Flat array of interleaved [baseOffset, count] pairs, parallel to this.splats.
     * For splat at index i: _partialData[i*2] = base offset into _subDrawTexture,
     * _partialData[i*2+1] = sub-draw count (0 means use splat's own sub-draws).
     *
     * @type {number[]}
     */
    _partialData = [];

    constructor(device, workBuffer, colorOnly = false) {
        super(device);
        this.workBuffer = workBuffer;
        this.colorOnly = colorOnly;
        this._subDrawTexture = Texture.createDataTexture2D(device, 'GsplatSubDrawData', 1, 1, PIXELFORMAT_RGBA32U);
    }

    destroy() {
        this.splats.length = 0;
        this._subDrawTexture.destroy();
        super.destroy();
    }

    /**
     * Initialize the render pass with the specified render target.
     *
     * @param {RenderTarget} renderTarget - The target to render to.
     */
    init(renderTarget) {
        super.init(renderTarget);
        this.colorOps.clear = false;
        this.depthStencilOps.clearDepth = false;
    }

    /**
     * Update the render pass with splats to render and camera.
     *
     * @param {GSplatInfo[]} splats - Array of GSplatInfo objects to render.
     * @param {GraphNode} cameraNode - The camera node for rendering.
     * @param {number[][]|undefined} colorsByLod - Optional array of RGB colors per LOD index.
     * @param {Set<number>|null} [changedAllocIds] - Set of changed allocIds for partial render.
     * @returns {boolean} True if there are splats to render, false otherwise.
     */
    update(splats, cameraNode, colorsByLod, changedAllocIds = null) {
        this.splats.length = 0;
        this._partialData.length = 0;
        this.colorsByLod = colorsByLod;

        const textureWidth = this.workBuffer.textureSize;

        if (changedAllocIds) {

            // Ensure shared sub-draw texture has enough capacity (grow-only)
            const requiredCapacity = changedAllocIds.size * 3;
            if (this._subDrawTexture.width * this._subDrawTexture.height < requiredCapacity) {
                TextureUtils.calcTextureSize(requiredCapacity, _tmpSize);
                this._subDrawTexture.resize(_tmpSize.x, _tmpSize.y);
            }

            const texData = /** @type {Uint32Array} */ (this._subDrawTexture.lock());
            let writeOffset = 0;

            for (let i = 0; i < splats.length; i++) {
                const splatInfo = splats[i];
                if (splatInfo.activeSplats <= 0) continue;

                const intervals = splatInfo.intervals;
                const numIntervals = intervals.length / 2;

                if (numIntervals === 0) {
                    // Non-octree: render using splat's own sub-draws if changed
                    if (changedAllocIds.has(splatInfo.allocId)) {
                        this.splats.push(splatInfo);
                        this._partialData.push(0, 0);
                    }
                } else {
                    // Octree: write sub-draws for changed intervals into shared texture
                    const baseOffset = writeOffset;
                    const allocIds = splatInfo.intervalAllocIds;

                    for (let j = 0; j < numIntervals; j++) {
                        if (changedAllocIds.has(allocIds[j])) {
                            writeOffset = splatInfo.appendSubDraws(
                                texData, writeOffset,
                                intervals[j * 2], intervals[j * 2 + 1] - intervals[j * 2],
                                splatInfo.intervalOffsets[j], textureWidth
                            );
                        }
                    }

                    const count = writeOffset - baseOffset;
                    if (count > 0) {
                        this.splats.push(splatInfo);
                        this._partialData.push(baseOffset, count);
                    }
                }
            }

            this._subDrawTexture.unlock();

        } else {

            // Full rebuild: all active splats, no partial data
            for (let i = 0; i < splats.length; i++) {
                const splatInfo = splats[i];
                if (splatInfo.activeSplats > 0) {
                    this.splats.push(splatInfo);
                    this._partialData.push(0, 0);
                }
            }
        }

        // Lazily create per-splat sub-draw textures only for splats that will use them
        // (those not using the shared partial texture, i.e. _partialData count === 0).
        for (let i = 0; i < this.splats.length; i++) {
            if (this._partialData[i * 2 + 1] === 0) {
                this.splats[i].ensureSubDrawTexture(textureWidth);
            }
        }

        this.cameraNode = cameraNode;
        return this.splats.length > 0;
    }

    execute() {
        const { device, splats, cameraNode, _partialData } = this;

        DebugGraphics.pushGpuMarker(device, 'GSplatWorkBuffer');

        // Set up render state
        device.setDrawStates();

        // view matrix
        const viewInvMat = cameraNode.getWorldTransform();
        const viewMat = _viewMat.copy(viewInvMat).invert();
        device.scope.resolve('matrix_view').setValue(viewMat.data);

        // render each splat info
        for (let i = 0; i < splats.length; i++) {
            const count = _partialData[i * 2 + 1];
            if (count > 0) {
                // Partial render using shared sub-draw texture with base offset
                this.renderSplat(splats[i], this._subDrawTexture, count, _partialData[i * 2]);
            } else {
                this.renderSplat(splats[i]);
            }
        }

        DebugGraphics.popGpuMarker(device);
    }

    /**
     * Render a single splat info object. Optionally renders only a subset of sub-draws
     * using an override texture and count (for partial work buffer updates).
     *
     * @param {GSplatInfo} splatInfo - The splat info to render.
     * @param {Texture} [overrideSubDrawTexture] - Override sub-draw texture for partial renders.
     * @param {number} [overrideSubDrawCount] - Override sub-draw count for partial renders.
     * @param {number} [subDrawBase] - Base offset into the sub-draw texture.
     */
    renderSplat(splatInfo, overrideSubDrawTexture, overrideSubDrawCount, subDrawBase = 0) {
        const { device, resource } = splatInfo;
        const scope = device.scope;
        Debug.assert(resource);

        const subDrawTexture = overrideSubDrawTexture ?? splatInfo.subDrawTexture;
        const subDrawCount = overrideSubDrawCount ?? splatInfo.subDrawCount;

        // Get work buffer modifier (live from placement, not a snapshot copy)
        const workBufferModifier = splatInfo.getWorkBufferModifier?.() ?? null;

        // Get format info directly from resource (always current, not snapshotted)
        const formatHash = resource.format.hash;
        const formatDeclarations = resource.format.getInputDeclarations();

        // quad renderer and material are cached in the resource
        const workBufferRenderInfo = resource.getWorkBufferRenderInfo(
            this.colorOnly,
            workBufferModifier,
            formatHash,
            formatDeclarations,
            this.workBuffer.format
        );

        // Assign material properties to scope
        workBufferRenderInfo.material.setParameters(device);

        // Colorize by LOD using provided colors; use index 0 as fallback for non-LOD splats
        const color = this.colorsByLod?.[splatInfo.lodIndex] ?? this.colorsByLod?.[0] ?? _whiteColor;
        scope.resolve('uColorMultiply').setValue(color);

        // Decompose model matrix into scale and rotation
        const worldTransform = splatInfo.node.getWorldTransform();
        worldTransform.getScale(_modelScale);
        _modelRotation.setFromMat4(worldTransform);

        // Ensure w positive for sqrt reconstruction
        if (_modelRotation.w < 0) {
            _modelRotation.mulScalar(-1);
        }

        // set as uniforms
        this._modelScaleData[0] = _modelScale.x;
        this._modelScaleData[1] = _modelScale.y;
        this._modelScaleData[2] = _modelScale.z;
        this._modelRotationData[0] = _modelRotation.x;
        this._modelRotationData[1] = _modelRotation.y;
        this._modelRotationData[2] = _modelRotation.z;
        this._modelRotationData[3] = _modelRotation.w;

        scope.resolve('matrix_model').setValue(worldTransform.data);
        scope.resolve('model_scale').setValue(this._modelScaleData);
        scope.resolve('model_rotation').setValue(this._modelRotationData);

        // Set placement ID for picking (unconditionally - cheap even if shader doesn't use it)
        scope.resolve('uId').setValue(splatInfo.placementId);

        // Apply per-instance shader parameters
        if (splatInfo.parameters) {
            for (const param of splatInfo.parameters.values()) {
                param.scopeId.setValue(param.data);
            }
        }

        // Bind instance textures if available (fetched live from placement)
        const instanceStreams = splatInfo.getInstanceStreams?.();
        if (instanceStreams) {
            // Sync to ensure textures exist for any newly added streams
            instanceStreams.syncWithFormat(splatInfo.resource.format);
            for (const [name, texture] of instanceStreams.textures) {
                scope.resolve(name).setValue(texture);
            }
        }

        // Instanced draw: one quad per sub-draw row-segment
        scope.resolve('uSubDrawData').setValue(subDrawTexture);
        scope.resolve('uSubDrawBase').setValue(subDrawBase);
        const ts = this.workBuffer.textureSize;
        this._textureSize[0] = ts;
        this._textureSize[1] = ts;
        scope.resolve('uTextureSize').setValue(this._textureSize);

        workBufferRenderInfo.quadRender.render(undefined, undefined, subDrawCount);
    }
}

export { GSplatWorkBufferRenderPass };
