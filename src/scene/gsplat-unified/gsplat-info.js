import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { GSplatIntervalTexture } from './gsplat-interval-texture.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResourceBase } from "../gsplat/gsplat-resource-base.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GraphNode } from '../graph-node.js';
 */

/**
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
     * @type {GSplatIntervalTexture}
     */
    intervalTexture;

    /**
     * Create a new GSplatInfo.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatResourceBase} resource - The splat resource.
     * @param {GSplatPlacement} placement - The placement of the splat.
     */
    constructor(device, resource, placement) {
        Debug.assert(resource);
        Debug.assert(placement);

        this.device = device;
        this.resource = resource;
        this.node = placement.node;
        this.lodIndex = placement.lodIndex;
        this.numSplats = resource.centers.length / 3;
        this.aabb.copy(placement.aabb);

        this.intervalTexture = new GSplatIntervalTexture(device);
        this.updateIntervals(placement.intervals);
    }

    destroy() {
        this.intervals.length = 0;
        this.intervalTexture.destroy();
    }

    setLines(start, count, textureSize, activeSplats) {
        this.lineStart = start;
        this.lineCount = count;
        this.padding = textureSize * count - activeSplats;
        Debug.assert(this.padding >= 0);
        this.viewport.set(0, start, textureSize, count);
    }

    updateIntervals(intervals) {

        const resource = this.resource;
        this.intervals.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (intervals.size > 0) {

            // copy the intervals to the state
            for (const interval of intervals.values()) {
                this.intervals.push(interval.x, interval.y + 1);
            }

            this.activeSplats = this.intervalTexture.update(this.intervals);
        }
    }

    update() {

        // if the object's matrix has changed, store the update version to know when it happened
        const worldMatrix = this.node.getWorldTransform();
        const worldMatrixChanged = !this.previousWorldTransform.equals(worldMatrix);
        if (worldMatrixChanged) {
            this.previousWorldTransform.copy(worldMatrix);
        }

        return worldMatrixChanged;
    }
}

export { GSplatInfo };
