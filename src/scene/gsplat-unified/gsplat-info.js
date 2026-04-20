import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_RGBA32U } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResourceBase } from "../gsplat/gsplat-resource-base.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GSplatStreams } from "../gsplat/gsplat-streams.js"
 * @import { GraphNode } from '../graph-node.js';
 * @import { GSplatOctreeNode } from './gsplat-octree-node.js';
 * @import { NodeInfo } from './gsplat-octree-instance.js';
 * @import { ScopeId } from '../../platform/graphics/scope-id.js';
 */

const tmpSize = new Vec2();

// Reusable buffer for sub-draw data (only grows, never shrinks)
let subDrawDataArray = new Uint32Array(0);

// Temporary full-range interval used by updateSubDraws when this.intervals is empty
const _fullRangeInterval = [0, 0];


/**
 * Represents a snapshot of gsplat state for rendering. This class captures all necessary data
 * at a point in time and should not hold references back to the source placement. All required
 * data should be copied or referenced, allowing placement to be modified without affecting the info.
 *
 * @ignore
 */
class GSplatInfo {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GSplatResourceBase} */
    resource;

    /** @type {GraphNode} */
    node;

    /** @type {number} */
    lodIndex;

    /**
     * Unique identifier from the placement, used for picking.
     *
     * @type {number}
     */
    placementId;

    /**
     * Unique allocation identifier for persistent work buffer allocation tracking.
     * Copied from the source placement.
     *
     * @type {number}
     */
    allocId;

    /**
     * Identifies the bounds group this splat belongs to. All file placements from the same
     * octree instance share the parent placement's allocId. Non-octree placements use their
     * own allocId. Used to deduplicate bounds and transform texture entries.
     *
     * @type {number}
     */
    parentPlacementId;

    /** @type {number} */
    numSplats;

    /** @type {number} */
    activeSplats = 0;

    /**
     * Array of intervals for remapping of indices, each two consecutive numbers represent
     * start and end of a range of splats.
     *
     * @type {number[]}
     */
    intervals = [];


    /**
     * Per-interval pixel offsets in the work buffer. For non-octree splats this has one entry.
     * For octree splats each entry corresponds to one interval in this.intervals.
     *
     * @type {number[]}
     */
    intervalOffsets = [];

    /**
     * Per-interval allocation IDs for persistent tracking. Parallel to intervals: for octree
     * splats each entry is the NodeInfo.allocId for that interval's node; for non-octree
     * splats this has one entry equal to this.allocId.
     *
     * @type {number[]}
     */
    intervalAllocIds = [];

    /**
     * Per-interval octree node indices. Parallel to intervals: for octree splats each entry
     * is the nodeIndex for that interval. Empty for non-octree splats.
     *
     * @type {number[]}
     */
    intervalNodeIndices = [];

    /** @type {Mat4} */
    previousWorldTransform = new Mat4();

    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /**
     * Small RGBA32U texture storing per-sub-draw data for instanced interval rendering.
     * Each texel: R = rowStart | (numRows << 16), G = colStart, B = colEnd, A = sourceBase.
     * Created lazily by {@link ensureSubDrawTexture} when needed for rendering.
     *
     * @type {Texture|null}
     */
    subDrawTexture = null;

    /**
     * Number of sub-draw instances for instanced interval rendering.
     */
    subDrawCount = 0;

    /**
     * Number of bounding sphere entries this GSplatInfo contributes to the shared bounds texture.
     */
    numBoundsEntries = 0;

    /**
     * Base index into the shared bounds sphere texture for this GSplatInfo's entries.
     */
    boundsBaseIndex = 0;

    /**
     * Octree nodes array reference for writing bounding sphere data. Set when the GSplatInfo
     * is created from an octree placement.
     *
     * @type {GSplatOctreeNode[]|null}
     */
    octreeNodes = null;

    /**
     * Per-node info array from the octree instance, providing allocId for each node.
     * Indexed by nodeIndex. Null for non-octree splats.
     *
     * @type {NodeInfo[]|null}
     */
    nodeInfos = null;

    /** @type {number} */
    colorAccumulatedTranslation = 0;

    /**
     * Per-instance shader parameters. Reference to the component's parameters Map.
     *
     * @type {Map<string, {scopeId: ScopeId, data: *}>|null}
     */
    parameters = null;

    /**
     * Function to get current work buffer modifier from source placement.
     * Retrieved live (not snapshotted) to ensure shader configuration stays current.
     *
     * @type {(() => ({ code: string, hash: number }|null))|null}
     */
    getWorkBufferModifier = null;

    /**
     * Function to get current instance streams from source placement.
     * Retrieved live (not snapshotted) to ensure streams are available after lazy creation.
     *
     * @type {(() => GSplatStreams|null)|null}
     */
    getInstanceStreams = null;

    /**
     * Callback to consume render dirty flag from the source placement.
     *
     * @type {Function|null}
     * @private
     */
    _consumeRenderDirty = null;

    /**
     * Create a new GSplatInfo.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatResourceBase} resource - The splat resource.
     * @param {GSplatPlacement} placement - The placement of the splat.
     * @param {Function|null} [consumeRenderDirty] - Callback to consume render dirty flag.
     * @param {GSplatOctreeNode[]|null} [octreeNodes] - Octree nodes for bounds lookup.
     * @param {NodeInfo[]|null} [nodeInfos] - Per-node info array from octree instance.
     */
    constructor(device, resource, placement, consumeRenderDirty = null, octreeNodes = null, nodeInfos = null) {
        Debug.assert(resource);
        Debug.assert(placement);

        this.device = device;
        this.resource = resource;
        this.node = placement.node;
        this.lodIndex = placement.lodIndex;
        this.placementId = placement.id;
        this.allocId = placement.allocId;
        // Only octree file splats (with octreeNodes) share the parent's bounds group.
        // Other child placements (e.g. environment) have independent bounds and must
        // use their own allocId.
        this.parentPlacementId = (octreeNodes && placement.parentPlacement) ?
            placement.parentPlacement.allocId :
            placement.allocId;
        this.numSplats = resource.numSplats;
        this.aabb.copy(placement.aabb);
        this.parameters = placement.parameters;
        this.getWorkBufferModifier = () => placement.workBufferModifier;
        this.getInstanceStreams = () => placement.streams;
        this._consumeRenderDirty = consumeRenderDirty;
        this.octreeNodes = octreeNodes;
        this.nodeInfos = nodeInfos;

        this.updateIntervals(placement.intervals);
    }

    destroy() {
        this.intervals.length = 0;
        this.intervalOffsets.length = 0;
        this.intervalAllocIds.length = 0;
        this.intervalNodeIndices.length = 0;
        this.subDrawTexture?.destroy();
        this.subDrawTexture = null;
        this.subDrawCount = 0;
    }

    /**
     * Sets per-interval pixel offsets for this splat. Sub-draw computation and GPU texture
     * creation are deferred to {@link ensureSubDrawTexture} to avoid work for splats that
     * may never be rendered (e.g. intermediate world states or unchanged splats).
     *
     * @param {number[]} intervalOffsets - Per-interval pixel offsets in the work buffer.
     */
    setLayout(intervalOffsets) {
        this.intervalOffsets = intervalOffsets;
        this.subDrawTexture?.destroy();
        this.subDrawTexture = null;
        this.subDrawCount = 0;
    }

    /**
     * Ensures the sub-draw texture exists, computing sub-draw data and creating the GPU texture
     * on first call. Must be called outside a render pass (e.g. in the render pass update method)
     * since WebGPU does not allow texture creation inside a render pass.
     *
     * @param {number} textureWidth - The work buffer texture width.
     */
    ensureSubDrawTexture(textureWidth) {
        if (!this.subDrawTexture && textureWidth > 0) {
            this.updateSubDraws(textureWidth);
        }
    }

    /**
     * Updates the flattened intervals array from placement intervals. Intervals are sorted and
     * stored as half-open pairs [start, end). Called once from the constructor; sub-draw data
     * is built later in setLayout when the work buffer texture width is known.
     *
     * @param {Map<number, Vec2>} intervals - Map of node index to inclusive [x, y] intervals.
     */
    updateIntervals(intervals) {

        const resource = this.resource;
        this.intervals.length = 0;
        this.intervalAllocIds.length = 0;
        this.intervalNodeIndices.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (intervals.size > 0) {

            // Write half-open intervals, count total splats, and build per-interval allocIds/nodeIndices
            let totalCount = 0;
            let k = 0;
            this.intervals.length = intervals.size * 2;
            for (const [nodeIndex, interval] of intervals) {
                this.intervals[k++] = interval.x;
                this.intervals[k++] = interval.y + 1;
                totalCount += (interval.y - interval.x + 1);

                if (this.nodeInfos) {
                    this.intervalAllocIds.push(this.nodeInfos[nodeIndex].allocId);
                    this.intervalNodeIndices.push(nodeIndex);
                }
            }

            if (this.octreeNodes) {
                // Octree: always keep intervals (even when fully loaded) so each node
                // maintains its own non-contiguous offset in the work buffer.
                // numBoundsEntries covers ALL nodes for stable boundsBaseIndex across LOD changes.
                this.activeSplats = totalCount;
                this.numBoundsEntries = this.octreeNodes.length;
            } else if (totalCount === this.numSplats) {
                // Non-octree: clear intervals when they cover the full range
                this.intervals.length = 0;
            } else {
                this.activeSplats = totalCount;
            }
        } else {
            // Non-octree: single bounds entry, single allocation
            this.numBoundsEntries = 1;
            this.intervalAllocIds.push(this.allocId);

            // check if we need to limit to active splats (instead of rendering all splats)
            const totalCapacity = resource.maxSplats;
            if (totalCapacity && this.activeSplats < totalCapacity) {
                // Provide interval [0, numSplats) to limit sorting to active splats only
                this.intervals[0] = 0;
                this.intervals[1] = this.activeSplats;
            }
        }
    }

    /**
     * Splits an interval at row boundaries into sub-draws (partial first row, full middle rows,
     * partial last row) and appends them to the sub-draw data array.
     *
     * @param {Uint32Array} subDrawData - The output array to append sub-draw entries to.
     * @param {number} subDrawCount - Current number of sub-draws already in the array.
     * @param {number} sourceBase - Source splat index for this interval.
     * @param {number} size - Number of splats in this interval.
     * @param {number} targetOffset - Pixel offset in the work buffer texture.
     * @param {number} textureWidth - Width of the work buffer texture.
     * @returns {number} Updated sub-draw count.
     */
    appendSubDraws(subDrawData, subDrawCount, sourceBase, size, targetOffset, textureWidth) {
        let remaining = size;
        let row = (targetOffset / textureWidth) | 0;
        const col = targetOffset % textureWidth;

        if (col > 0) {
            const count = Math.min(remaining, textureWidth - col);
            const idx = subDrawCount * 4;
            subDrawData[idx] = row | (1 << 16);
            subDrawData[idx + 1] = col;
            subDrawData[idx + 2] = col + count;
            subDrawData[idx + 3] = sourceBase;
            subDrawCount++;
            sourceBase += count;
            remaining -= count;
            row++;
        }

        const fullRows = (remaining / textureWidth) | 0;
        if (fullRows > 0) {
            const idx = subDrawCount * 4;
            subDrawData[idx] = row | (fullRows << 16);
            subDrawData[idx + 1] = 0;
            subDrawData[idx + 2] = textureWidth;
            subDrawData[idx + 3] = sourceBase;
            subDrawCount++;
            sourceBase += fullRows * textureWidth;
            remaining -= fullRows * textureWidth;
            row += fullRows;
        }

        if (remaining > 0) {
            const idx = subDrawCount * 4;
            subDrawData[idx] = row | (1 << 16);
            subDrawData[idx + 1] = 0;
            subDrawData[idx + 2] = remaining;
            subDrawData[idx + 3] = sourceBase;
            subDrawCount++;
        }

        return subDrawCount;
    }

    /**
     * Builds the sub-draw data texture from the current intervals (or a synthetic full-range
     * interval when none exist). Each interval is split at row boundaries of the work buffer
     * texture to produce axis-aligned rectangles stored as a small RGBA32U texture.
     *
     * @param {number} textureWidth - The work buffer texture width.
     */
    updateSubDraws(textureWidth) {

        // Use a local full-range interval when none exist, so the instanced draw path
        // always has sub-draws. This must NOT mutate this.intervals because the GPU
        // interval compaction reads this.intervals separately for per-node culling.
        let intervals = this.intervals;
        let numIntervals = intervals.length / 2;
        if (numIntervals === 0) {
            _fullRangeInterval[0] = 0;
            _fullRangeInterval[1] = this.activeSplats;
            intervals = _fullRangeInterval;
            numIntervals = 1;
        }

        // Split intervals at row boundaries. Each interval produces at most 3 sub-draws:
        // partial first row, full middle rows, partial last row.
        // Reuse module-scope buffer, growing if needed (4 uints per sub-draw, 3 sub-draws per interval max).
        const maxSubDraws = numIntervals * 3;
        const requiredSize = maxSubDraws * 4;
        if (subDrawDataArray.length < requiredSize) {
            subDrawDataArray = new Uint32Array(requiredSize);
        }
        const subDrawData = subDrawDataArray;
        let subDrawCount = 0;

        for (let i = 0; i < numIntervals; i++) {
            subDrawCount = this.appendSubDraws(subDrawData, subDrawCount,
                intervals[i * 2], intervals[i * 2 + 1] - intervals[i * 2],
                this.intervalOffsets[i], textureWidth);
        }

        this.subDrawCount = subDrawCount;

        // Calculate 2D texture dimensions to stay within device limits
        const { x: texWidth, y: texHeight } = TextureUtils.calcTextureSize(subDrawCount, tmpSize);

        // Create the sub-draw data texture
        this.subDrawTexture = Texture.createDataTexture2D(this.device, 'subDrawData', texWidth, texHeight, PIXELFORMAT_RGBA32U);

        // Upload sub-draw data
        const texData = this.subDrawTexture.lock();
        texData.set(subDrawData.subarray(0, subDrawCount * 4));
        this.subDrawTexture.unlock();
    }

    update() {
        const worldMatrix = this.node.getWorldTransform();
        const worldMatrixChanged = !this.previousWorldTransform.equals(worldMatrix);
        if (worldMatrixChanged) {
            this.previousWorldTransform.copy(worldMatrix);
        }

        const renderDirty = this._consumeRenderDirty ? this._consumeRenderDirty() : false;

        return worldMatrixChanged || renderDirty;
    }

    /**
     * Writes bounding sphere data for this GSplatInfo into a shared Float32Array.
     * For octree resources, writes spheres for ALL nodes (indexed by nodeIndex) to keep
     * boundsBaseIndex stable across LOD changes.
     * For non-octree resources, computes a single sphere from the resource AABB.
     *
     * @param {Float32Array} data - The shared bounds sphere data array.
     * @param {number} offset - The float offset to start writing at.
     */
    writeBoundsSpheres(data, offset) {
        if (this.octreeNodes) {
            for (let i = 0; i < this.octreeNodes.length; i++) {
                const s = this.octreeNodes[i].boundingSphere;
                data[offset++] = s.x;
                data[offset++] = s.y;
                data[offset++] = s.z;
                data[offset++] = s.w;
            }
        } else {
            // Non-octree: single sphere from resource AABB
            const aabb = this.resource.aabb;
            const he = aabb.halfExtents;
            const r = Math.sqrt(he.x * he.x + he.y * he.y + he.z * he.z);
            data[offset++] = aabb.center.x;
            data[offset++] = aabb.center.y;
            data[offset++] = aabb.center.z;
            data[offset++] = r;
        }
    }

    get hasSphericalHarmonics() {
        return this.resource.gsplatData?.shBands > 0;
    }
}

export { GSplatInfo };
