import { Debug } from '../../core/debug.js';

/**
 * @import { GSplatInfo } from './gsplat-info.js'
 * @import { GSplatOctree } from './gsplat-octree.js'
 */

class GSplatWorldState {
    /**
     * The version of the world state.
     *
     * @type {number}
     */
    version = 0;

    /**
     * Whether the sort parameters have been set on the sorter.
     *
     * @type {boolean}
     */
    sortParametersSet = false;

    /**
     * Whether the world state has been sorted before.
     *
     * @type {boolean}
     */
    sortedBefore = false;

    /**
     * An array of all splats managed by this world state.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /**
     * The texture size of work buffer.
     *
     * @type {number}
     */
    textureSize = 0;

    /**
     * Total number of active splats across all placements.
     *
     * @type {number}
     */
    totalActiveSplats = 0;

    /**
     * Total number of intervals across all placements. Each placement contributes
     * either its interval count (intervals.length / 2) or 1 if it has no intervals.
     *
     * @type {number}
     */
    totalIntervals = 0;

    /**
     * Files to decrement when this state becomes active.
     * Array of tuples: [octree, fileIndex]
     * @type {Array<[GSplatOctree, number]>}
     */
    pendingReleases = [];

    constructor(device, version, splats) {
        this.version = version;
        this.splats = splats;

        let totalPixels = 0;
        for (let i = 0; i < splats.length; i++) {
            totalPixels += splats[i].activeSplats;
        }
        this.textureSize = totalPixels > 0 ? Math.ceil(Math.sqrt(totalPixels)) : 1;
        Debug.assert(this.textureSize <= device.maxTextureSize, `GSplatWorldState: required texture size ${this.textureSize} exceeds device limit ${device.maxTextureSize}`);
        this.assignOffsets(this.splats);
    }

    destroy() {
        this.splats.forEach(splat => splat.destroy());
        this.splats.length = 0;
    }

    /**
     * Assigns pixel offsets to each splat, packing them contiguously with no row padding.
     *
     * @param {GSplatInfo[]} splats - The splats to assign offsets to.
     */
    assignOffsets(splats) {
        if (splats.length === 0) {
            this.totalActiveSplats = 0;
            this.totalIntervals = 0;
            return;
        }

        let pixelOffset = 0;
        let totalIntervals = 0;
        for (const splat of splats) {
            // Count intervals for GPU compaction. Partial-load octree splats use the flat
            // intervals array; fully-loaded octree splats (intervals cleared) fall back to
            // placementIntervals for per-node culling granularity; non-octree splats use 1.
            if (splat.intervals.length > 0) {
                totalIntervals += splat.intervals.length / 2;
            } else if (splat.placementIntervals && splat.placementIntervals.size > 0) {
                totalIntervals += splat.placementIntervals.size;
            } else {
                totalIntervals += 1;
            }
            splat.setLayout(pixelOffset, this.textureSize, splat.activeSplats);
            pixelOffset += splat.activeSplats;
        }

        this.totalActiveSplats = pixelOffset;
        this.totalIntervals = totalIntervals;
    }
}

export { GSplatWorldState };
