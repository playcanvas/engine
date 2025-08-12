import { Vec4 } from '../../core/math/vec4.js';
import { Debug } from '../../core/debug.js';
import { GSplatIntervalTexture } from './gsplat-interval-texture.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatResource } from '../gsplat/gsplat-resource.js'
 * @import { GSplatPlacement } from './gsplat-placement.js'
 */

/**
 * GSplatState stores a state of a splat, including its LOD configuration, allocated space in
 * various global buffers and similar.
 *
 * @ignore
 */
class GSplatState {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GSplatResource} */
    resource;

    /** @type {GSplatPlacement} */
    placement;

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

    /**
     * Manager for the intervals texture generation
     *
     * @type {GSplatIntervalTexture}
     */
    intervalTexture;

    /**
     * @param {GraphicsDevice} device - The graphics device
     * @param {GSplatResource} resource - The splat resource this LOD manager handles
     * @param {GSplatPlacement} placement - The placement this splat belongs to
     */
    constructor(device, resource, placement) {
        this.device = device;
        this.resource = resource;
        this.placement = placement;
        this.intervalTexture = new GSplatIntervalTexture(device);
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

    update() {

        const resource = this.resource;
        this.intervals.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (this.placement.intervals.size > 0) {

            // copy the intervals to the state
            for (const interval of this.placement.intervals.values()) {
                this.intervals.push(interval.x, interval.y + 1);
            }

            this.activeSplats = this.intervalTexture.update(this.intervals);
        }
    }
}

export { GSplatState };
