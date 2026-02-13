import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_R32U, PIXELFORMAT_RGBA32U } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResourceBase } from "../gsplat/gsplat-resource-base.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GSplatStreams } from "../gsplat/gsplat-streams.js"
 * @import { GraphNode } from '../graph-node.js';
 * @import { GSplatOctreeNode } from './gsplat-octree-node.js';
 * @import { ScopeId } from '../../platform/graphics/scope-id.js';
 */

const tmpSize = new Vec2();

// Reusable buffer for sub-draw data (only grows, never shrinks)
let subDrawDataArray = new Uint32Array(0);

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

    /** @type {number} */
    lineStart = 0;

    /** @type {number} */
    lineCount = 0;

    /** @type {number} */
    padding = 0;

    /** @type {Vec4} */
    viewport = new Vec4();

    /** @type {Mat4} */
    previousWorldTransform = new Mat4();

    /** @type {BoundingBox} */
    aabb = new BoundingBox();

    /**
     * Small RGBA32U texture storing per-sub-draw data for instanced interval rendering.
     * Each texel: R = rowStart | (numRows << 16), G = colStart, B = colEnd, A = sourceBase.
     * Null when intervals are not used (non-LOD or full range).
     *
     * @type {Texture|null}
     */
    subDrawTexture = null;

    /**
     * Number of sub-draw instances for instanced interval rendering.
     *
     * @type {number}
     */
    subDrawCount = 0;

    /**
     * Small R32U texture mapping octree node index to sequential local bounds index.
     * Used by the GPU culling system during work buffer rendering.
     *
     * @type {Texture|null}
     */
    nodeToLocalBoundsTexture = null;

    /**
     * Number of bounding sphere entries this GSplatInfo contributes to the shared bounds texture.
     *
     * @type {number}
     */
    numBoundsEntries = 0;

    /**
     * Base index into the shared bounds sphere texture for this GSplatInfo's entries.
     *
     * @type {number}
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
     * Reference to the placement's intervals map for bounds sphere writing.
     * Kept as a live reference since the placement intervals are stable during a frame.
     *
     * @type {Map<number, Vec2>|null}
     */
    placementIntervals = null;

    /** @type {number} */
    colorAccumulatedRotation = 0;

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
     */
    constructor(device, resource, placement, consumeRenderDirty = null, octreeNodes = null) {
        Debug.assert(resource);
        Debug.assert(placement);

        this.device = device;
        this.resource = resource;
        this.node = placement.node;
        this.lodIndex = placement.lodIndex;
        this.placementId = placement.id;
        this.numSplats = resource.numSplats;
        this.aabb.copy(placement.aabb);
        this.parameters = placement.parameters;
        this.getWorkBufferModifier = () => placement.workBufferModifier;
        this.getInstanceStreams = () => placement.streams;
        this._consumeRenderDirty = consumeRenderDirty;
        this.octreeNodes = octreeNodes;

        this.updateIntervals(placement.intervals);
    }

    destroy() {
        this.intervals.length = 0;
        this.subDrawTexture?.destroy();
        this.subDrawTexture = null;
        this.subDrawCount = 0;
        this.nodeToLocalBoundsTexture?.destroy();
        this.nodeToLocalBoundsTexture = null;
    }

    setLines(start, count, textureSize, activeSplats) {
        this.lineStart = start;
        this.lineCount = count;
        this.padding = textureSize * count - activeSplats;
        Debug.assert(this.padding >= 0);
        this.viewport.set(0, start, textureSize, count);

        // Build sub-draw data for instanced interval rendering
        if (this.intervals.length > 0) {
            this.updateSubDraws(textureSize);
        }
    }

    /**
     * Updates the flattened intervals array from placement intervals. Intervals are sorted and
     * stored as half-open pairs [start, end). Called once from the constructor; sub-draw data
     * is built later in setLines when the work buffer texture width is known.
     *
     * @param {Map<number, Vec2>} intervals - Map of node index to inclusive [x, y] intervals.
     */
    updateIntervals(intervals) {

        const resource = this.resource;
        this.intervals.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (intervals.size > 0) {

            // Write half-open intervals and count total splats
            let totalCount = 0;
            let k = 0;
            this.intervals.length = intervals.size * 2;
            for (const interval of intervals.values()) {
                this.intervals[k++] = interval.x;
                this.intervals[k++] = interval.y + 1;
                totalCount += (interval.y - interval.x + 1);
            }

            // If intervals cover the full range, they're not needed
            if (totalCount === this.numSplats) {
                this.intervals.length = 0;
            } else {
                this.activeSplats = totalCount;
            }

            // Update nodeToLocalBounds mapping for GPU culling
            if (this.octreeNodes) {
                this.placementIntervals = intervals;
                this.updateNodeToLocalBounds(intervals, this.octreeNodes.length);
            }
        } else {
            // Non-octree: single bounds entry
            this.numBoundsEntries = 1;

            // check if we need to limit to active splats (instead of rendering all splats)
            const totalCenters = resource.centers?.length / 3;
            if (totalCenters && this.activeSplats < totalCenters) {
                // Provide interval [0, numSplats) to limit sorting to active splats only
                this.intervals[0] = 0;
                this.intervals[1] = this.activeSplats;
            }
        }
    }

    /**
     * Builds the sub-draw data texture from the current intervals. Each interval is split at
     * row boundaries of the work buffer texture to produce axis-aligned rectangles. The result
     * is a small RGBA32U texture where each texel stores the parameters for one instanced quad.
     * Called once from setLines when the work buffer texture width is known.
     *
     * @param {number} textureWidth - The work buffer texture width.
     */
    updateSubDraws(textureWidth) {

        const numIntervals = this.intervals.length / 2;

        // Split intervals at row boundaries. Each interval produces at most 3 sub-draws:
        // partial first row, full middle rows, partial last row.
        // Reuse module-scope buffer, growing if needed (4 uints per sub-draw, 3 sub-draws per interval max).
        const maxSubDraws = numIntervals * 3;
        const requiredSize = maxSubDraws * 4;
        if (subDrawDataArray.length < requiredSize) {
            subDrawDataArray = new Uint32Array(requiredSize);
        }
        const subDrawData = subDrawDataArray;
        const intervals = this.intervals;
        let subDrawCount = 0;
        let targetOffset = 0; // running target index across all intervals

        for (let i = 0; i < numIntervals; i++) {
            let sourceBase = intervals[i * 2];
            const size = intervals[i * 2 + 1] - sourceBase;

            let remaining = size;
            let row = (targetOffset / textureWidth) | 0;
            const col = targetOffset % textureWidth;

            // Partial first row (if not starting at column 0)
            if (col > 0) {
                const count = Math.min(remaining, textureWidth - col);
                const idx = subDrawCount * 4;
                subDrawData[idx] = row | (1 << 16);         // rowStart | (numRows << 16)
                subDrawData[idx + 1] = col;                   // colStart
                subDrawData[idx + 2] = col + count;           // colEnd
                subDrawData[idx + 3] = sourceBase;             // sourceBase
                subDrawCount++;
                sourceBase += count;
                remaining -= count;
                row++;
            }

            // Full middle rows
            const fullRows = (remaining / textureWidth) | 0;
            if (fullRows > 0) {
                const idx = subDrawCount * 4;
                subDrawData[idx] = row | (fullRows << 16);     // rowStart | (numRows << 16)
                subDrawData[idx + 1] = 0;                       // colStart
                subDrawData[idx + 2] = textureWidth;             // colEnd
                subDrawData[idx + 3] = sourceBase;               // sourceBase
                subDrawCount++;
                sourceBase += fullRows * textureWidth;
                remaining -= fullRows * textureWidth;
                row += fullRows;
            }

            // Partial last row
            if (remaining > 0) {
                const idx = subDrawCount * 4;
                subDrawData[idx] = row | (1 << 16);          // rowStart | (numRows << 16)
                subDrawData[idx + 1] = 0;                      // colStart
                subDrawData[idx + 2] = remaining;              // colEnd
                subDrawData[idx + 3] = sourceBase;              // sourceBase
                subDrawCount++;
            }

            targetOffset += size;
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

    resetColorAccumulators(colorUpdateAngle, colorUpdateDistance) {
        // Use a single random factor (0 to 1) for both accumulators to keep them synchronized
        // This ensures rotation and translation thresholds trigger at similar rates
        const randomFactor = Math.random();
        this.colorAccumulatedRotation = randomFactor * colorUpdateAngle;
        this.colorAccumulatedTranslation = randomFactor * colorUpdateDistance;
    }

    /**
     * Builds the nodeToLocalBounds mapping from the placement intervals. Each selected octree
     * node gets a sequential index; unselected nodes remain 0. Uploads to a small R32U
     * texture for GPU access during work buffer rendering.
     *
     * @param {Map<number, Vec2>} intervals - Map of node index to interval.
     * @param {number} numNodes - Total number of octree nodes.
     */
    updateNodeToLocalBounds(intervals, numNodes) {
        // Calculate texture dimensions for the small lookup texture
        const { x: width, y: height } = TextureUtils.calcTextureSize(numNodes, tmpSize);
        const texelCount = width * height;

        // Build the mapping: selected nodes get sequential indices
        const data = new Uint32Array(texelCount);

        let localIdx = 0;
        for (const nodeIndex of intervals.keys()) {
            data[nodeIndex] = localIdx++;
        }
        this.numBoundsEntries = localIdx;

        // Create the texture with initial data
        this.nodeToLocalBoundsTexture = Texture.createDataTexture2D(this.device, 'nodeToLocalBoundsTexture', width, height, PIXELFORMAT_R32U, [data]);
    }

    /**
     * Writes bounding sphere data for this GSplatInfo into a shared Float32Array.
     * For octree resources, copies precomputed spheres from octree nodes.
     * For non-octree resources, computes a single sphere from the resource AABB.
     *
     * @param {Float32Array} data - The shared bounds sphere data array.
     * @param {number} offset - The float offset to start writing at.
     */
    writeBoundsSpheres(data, offset) {
        if (this.octreeNodes) {
            // Octree: copy precomputed spheres for each selected node
            for (const nodeIndex of this.placementIntervals.keys()) {
                const s = this.octreeNodes[nodeIndex].boundingSphere;
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
