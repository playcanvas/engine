import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatIntervalTexture } from './gsplat-interval-texture.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResourceBase } from "../gsplat/gsplat-resource-base.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GSplatStreams } from "../gsplat/gsplat-streams.js"
 * @import { GraphNode } from '../graph-node.js';
 * @import { ScopeId } from '../../platform/graphics/scope-id.js';
 * @import { Vec2 } from '../../core/math/vec2.js';
 */

/** @type {Vec2[]} */
const vecs = [];

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
     * Custom shader code for work buffer modification (object with code and pre-computed hash).
     *
     * @type {{ code: string, hash: number }|null}
     */
    workBufferModifier = null;

    /**
     * Instance texture streams (reference to placement's streams, stable object).
     *
     * @type {GSplatStreams|null}
     */
    instanceStreams = null;

    /**
     * Format hash captured at creation time for shader caching.
     *
     * @type {number}
     */
    formatHash = 0;

    /**
     * Format declarations captured at creation time for shader compilation.
     *
     * @type {string}
     */
    formatDeclarations = '';

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
     */
    constructor(device, resource, placement, consumeRenderDirty = null) {
        Debug.assert(resource);
        Debug.assert(placement);

        this.device = device;
        this.resource = resource;
        this.node = placement.node;
        this.lodIndex = placement.lodIndex;
        this.numSplats = resource.numSplats;
        this.aabb.copy(placement.aabb);
        this.parameters = placement.parameters;
        this.workBufferModifier = placement.workBufferModifier;
        this.formatHash = resource.format.hash;
        this.formatDeclarations = resource.format.getInputDeclarations();
        this._consumeRenderDirty = consumeRenderDirty;

        // no need to deep copy as streams can only be added to, so it won't hurt to have additional
        // textures that the shader does not use yet.
        this.instanceStreams = placement.streams;

        this.updateIntervals(placement.intervals);
    }

    destroy() {
        this.intervals.length = 0;
        this.intervalTexture?.destroy();
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

            // clear temp array
            vecs.length = 0;
        } else {
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

    get hasSphericalHarmonics() {
        return this.resource.gsplatData?.shBands > 0;
    }
}

export { GSplatInfo };
