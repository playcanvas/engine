import { Vec3 } from '../../../core/math/vec3.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U } from '../../../platform/graphics/constants.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { Debug } from '../../../core/debug.js';

/**
 * @import { GraphNode } from "../../graph-node.js"
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { GSplatResource } from '../gsplat-resource.js'
 */

const localCameraPos = new Vec3();

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

    /** @type {GraphNode} */
    node;

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

    /** @type {Vec4} */
    viewport = new Vec4();

    /**
     * Texture that maps target indices to source splat indices based on intervals
     *
     * @type {Texture|null}
     */
    intervalsTexture = null;

    /**
     * @param {GraphicsDevice} device - The graphics device
     * @param {GSplatResource} resource - The splat resource this LOD manager handles
     * @param {GraphNode} node - The node this splat belongs to
     */
    constructor(device, resource, node) {
        this.device = device;
        this.resource = resource;
        this.node = node;
    }

    destroy() {
        this.intervals.length = 0;
        this.intervalsTexture?.destroy();
        this.intervalsTexture = null;
    }

    setLines(start, count, textureSize) {
        this.lineStart = start;
        this.lineCount = count;
        this.viewport.set(0, start, textureSize, count);
    }

    /**
     * Creates a texture that maps target indices to source splat indices based on intervals
     */
    updateIntervalsTexture() {
        // Count total number of splats referenced by intervals
        let totalSplats = 0;
        for (let i = 0; i < this.intervals.length; i += 2) {
            const start = this.intervals[i];
            const end = this.intervals[i + 1];
            totalSplats += (end - start);
        }

        this.activeSplats = totalSplats;

        if (totalSplats === 0) {
            return;
        }

        // Estimate roughly square texture size
        const maxTextureSize = this.device.maxTextureSize;
        let textureWidth = Math.ceil(Math.sqrt(totalSplats));
        textureWidth = Math.min(textureWidth, maxTextureSize);
        const textureHeight = Math.ceil(totalSplats / textureWidth);

        // Create initial 1x1 texture
        if (!this.intervalsTexture) {
            this.intervalsTexture = this.createTexture('intervalsTexture', PIXELFORMAT_R32U, 1, 1);
        }

        // Resize texture if dimensions changed
        if (this.intervalsTexture.width !== textureWidth || this.intervalsTexture.height !== textureHeight) {
            this.intervalsTexture.resize(textureWidth, textureHeight);
        }

        // update mapping data
        if (this.intervalsTexture) {
            const pixels = this.intervalsTexture.lock();
            let targetIndex = 0;

            for (let i = 0; i < this.intervals.length; i += 2) {
                const start = this.intervals[i];
                const end = this.intervals[i + 1];

                for (let splatIndex = start; splatIndex < end; splatIndex++) {
                    pixels[targetIndex] = splatIndex;
                    targetIndex++;
                }
            }

            this.intervalsTexture.unlock();
        }
    }

    createTexture(name, format, width, height) {
        return new Texture(this.device, {
            name: name,
            width: width,
            height: height,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    /**
     * @param {GraphNode} cameraNode - The camera node for LOD calculation
     */
    update(cameraNode) {

        const resource = this.resource;
        if (!resource.hasLod) {
            this.activeSplats = resource.numSplats;
            return;
        }

        Debug.assert(resource.lodBlocks);
        Debug.assert(resource.lodBlocks.blocksCenter);
        Debug.assert(resource.lodBlocks.blocksLodInfo);

        // Get camera position in world space
        const cameraPos = cameraNode.getWorldTransform().getTranslation();

        this.intervals.length = 0;
        const blockSize = resource.lodBlocks.blockSize;
        const numBlocks = resource.lodBlocks.numBlocks;

        // DEBUG: LOD distribution tracking per splat (can be removed for production)
        const lodCounts = {}; // Track LOD usage counts

        // Transform camera position to local space of this splat
        const splatTransform = this.node.getWorldTransform();
        const invSplatTransform = splatTransform.clone().invert();
        invSplatTransform.transformPoint(cameraPos, localCameraPos);

        // Calculate LOD and create intervals for each block
        for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
            const centerBase = blockIdx * 3;
            const blockCenter = new Vec3(
                resource.lodBlocks.blocksCenter[centerBase],
                resource.lodBlocks.blocksCenter[centerBase + 1],
                resource.lodBlocks.blocksCenter[centerBase + 2]
            );

            // Calculate distance from camera to block center
            const distance = localCameraPos.distance(blockCenter);

            // Define distance thresholds for LOD selection (supports up to 5 levels)
            // TODO: make this configurable and exposed
            const distanceThresholds = [6, 12, 20, 35];
            const numLevels = resource.lodBlocks.blockLevels;

            // Use only the thresholds we need based on numLevels
            const activeThresholds = distanceThresholds.slice(0, numLevels - 1);

            // Assign LOD based on distance thresholds
            let selectedLod = 0;
            for (let i = 0; i < activeThresholds.length; i++) {
                if (distance >= activeThresholds[i]) {
                    selectedLod = i + 1;
                }
            }

            // Clamp to valid range
            selectedLod = Math.min(selectedLod, numLevels - 1);

            // DEBUG: Count LOD usage per splat (can be removed for production)
            if (!lodCounts[selectedLod]) lodCounts[selectedLod] = 0;
            lodCounts[selectedLod]++;

            // Get splat counts for each LOD level
            const lodInfoBase = blockIdx * numLevels;
            const splatCounts = new Array(numLevels);
            for (let level = 0; level < numLevels; level++) {
                splatCounts[level] = resource.lodBlocks.blocksLodInfo[lodInfoBase + level];
            }

            // Calculate block base offset
            const blockBase = blockIdx * blockSize;

            // Create intervals based on selected LOD
            // selectedLod represents detail level: 0=highest detail (all levels), higher=lower detail
            // Show splats from level 0 up to (numLevels - 1 - selectedLod) inclusive
            const maxLevelToShow = numLevels - 1 - selectedLod;
            let totalSplats = 0;
            for (let level = 0; level <= maxLevelToShow; level++) {
                totalSplats += splatCounts[level];
            }

            if (totalSplats > 0) {
                const start = blockBase;
                const end = blockBase + totalSplats;
                this.intervals.push(start, end);
            }
        }

        // // DEBUG: Log LOD distribution per splat (remove this entire block for production)
        // if (numBlocks > 0) {
        //     const pcts = lodCounts.map(count => ((count / numBlocks) * 100).toFixed(1));
        //     console.log(`Block LOD Distribution (blocks: ${numBlocks}): LOD 0: ${pcts[0]}%, LOD 1: ${pcts[1]}%, LOD 2: ${pcts[2]}%`);
        // }

        this.updateIntervalsTexture();
    }
}

export { GSplatState };
