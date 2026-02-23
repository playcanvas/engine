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
     * Total number of pixels actually used in the texture (excluding unused regions).
     * This is the count that should be sent to the sort worker and renderer.
     *
     * @type {number}
     */
    totalUsedPixels = 0;

    /**
     * Total number of active (non-padding) splats across all placements.
     * Excludes row-alignment padding at the end of each placement's last line.
     *
     * @type {number}
     */
    totalActiveSplats = 0;

    /**
     * Files to decrement when this state becomes active.
     * Array of tuples: [octree, fileIndex]
     * @type {Array<[GSplatOctree, number]>}
     */
    pendingReleases = [];

    constructor(device, version, splats) {
        this.version = version;
        this.splats = splats;

        this.estimateTextureSize(this.splats, device.maxTextureSize);
        this.assignLines(this.splats, this.textureSize);
    }

    /**
     * Estimates the square texture size that can store all splats, using binary search to find the
     * smallest size that fits.
     *
     * @param {GSplatInfo[]} splats - The splats to allocate space for.
     * @param {number} maxSize - Max texture size (width and height).
     * @returns {boolean} - True if the texture size was found.
     */
    estimateTextureSize(splats, maxSize) {
        const fits = (size) => {
            let rows = 0;
            for (const splat of splats) {
                rows += Math.ceil(splat.activeSplats / size);
                if (rows > size) return false;
            }
            return true;
        };

        let low = 1;
        let high = maxSize;
        let bestSize = null;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (fits(mid)) {
                bestSize = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        if (bestSize === null) {
            this.textureSize = 0;
            Debug.error('estimateTextureSize: failed to find a valid texture size');
            return false;
        }

        this.textureSize = bestSize;
        return true;
    }

    destroy() {
        this.splats.forEach(splat => splat.destroy());
        this.splats.length = 0;
    }

    /**
     * Assigns lines to each splat based on the texture size.
     *
     * @param {GSplatInfo[]} splats - The splats to assign lines to.
     * @param {number} size - The texture size.
     */
    assignLines(splats, size) {
        if (splats.length === 0) {
            this.totalUsedPixels = 0;
            this.totalActiveSplats = 0;
            return;
        }

        let start = 0;
        let totalActive = 0;
        for (const splat of splats) {
            const activeSplats = splat.activeSplats;
            totalActive += activeSplats;
            const numLines = Math.ceil(activeSplats / size);
            splat.setLines(start, numLines, size, activeSplats);
            start += numLines;
        }

        this.totalUsedPixels = start * size;
        this.totalActiveSplats = totalActive;
    }
}

export { GSplatWorldState };
