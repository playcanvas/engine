import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_R32U, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { TextureUtils } from '../../platform/graphics/texture-utils.js';
import { GSplatIntervalTexture } from './gsplat-interval-texture.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResourceBase } from "../gsplat/gsplat-resource-base.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GSplatStreams } from "../gsplat/gsplat-streams.js"
 * @import { GraphNode } from '../graph-node.js';
 * @import { GSplatOctreeNode } from './gsplat-octree-node.js';
 * @import { ScopeId } from '../../platform/graphics/scope-id.js';
 */

/** @type {Vec2[]} */
const vecs = [];

const tmpSize = new Vec2();

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
     * Manager for the intervals texture generation
     *
     * @type {GSplatIntervalTexture|null}
     */
    intervalTexture = null;

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
        this.intervalTexture?.destroy();
        this.nodeToLocalBoundsTexture?.destroy();
        this.nodeToLocalBoundsTexture = null;
    }

    setLines(start, count, textureSize, activeSplats) {
        this.lineStart = start;
        this.lineCount = count;
        this.padding = textureSize * count - activeSplats;
        Debug.assert(this.padding >= 0);
        this.viewport.set(0, start, textureSize, count);
    }

    /**
     * Updates the flattened intervals array and GPU texture from placement intervals.
     * Also updates the nodeToLocalBounds texture if octree nodes are available.
     *
     * @param {Map<number, Vec2>} intervals - Map of node index to inclusive [x, y] intervals.
     */
    updateIntervals(intervals) {

        const resource = this.resource;
        this.intervals.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (intervals.size > 0) {

            // fast path: if the intervals cover the full range, intervals are not needed
            // also collect references to inclusive Vec2 intervals into a reusable array for sorting
            let totalCount = 0;
            let used = 0;
            for (const interval of intervals.values()) {
                totalCount += (interval.y - interval.x + 1);
                vecs[used++] = interval;
            }

            // not full range
            if (totalCount !== this.numSplats) {

                // finalize temp array length for sorting/merging
                vecs.length = used;

                // sort by start
                vecs.sort((a, b) => (a.x - b.x));

                // pre-size to the upper bound
                this.intervals.length = used * 2;

                // write merged intervals directly to this.intervals
                let k = 0;
                let currentStart = vecs[0].x;
                let currentEnd = vecs[0].y;
                for (let i = 1; i < used; i++) {
                    const p = vecs[i];
                    if (p.x === currentEnd + 1) {  // adjacent, extend current interval
                        currentEnd = p.y;
                    } else { // write half-open pair
                        this.intervals[k++] = currentStart;
                        this.intervals[k++] = currentEnd + 1;
                        currentStart = p.x;
                        currentEnd = p.y;
                    }
                }
                // write final half-open pair
                this.intervals[k++] = currentStart;
                this.intervals[k++] = currentEnd + 1;

                // trim to actual merged length
                this.intervals.length = k;

                // update GPU texture and active splats count
                this.intervalTexture = new GSplatIntervalTexture(this.device);
                this.activeSplats = this.intervalTexture.update(this.intervals, totalCount);
            }

            // Update nodeToLocalBounds mapping for GPU culling
            if (this.octreeNodes) {
                this.placementIntervals = intervals;
                this.updateNodeToLocalBounds(intervals, this.octreeNodes.length);
            }

            // clear temp array
            vecs.length = 0;
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
        this.nodeToLocalBoundsTexture = new Texture(this.device, {
            name: 'nodeToLocalBoundsTexture',
            width: width,
            height: height,
            format: PIXELFORMAT_R32U,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            levels: [data]
        });
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
