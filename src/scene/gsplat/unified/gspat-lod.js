import { Vec3 } from '../../../core/math/vec3.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U } from '../../../platform/graphics/constants.js';

/**
 * @import { GraphNode } from "../../graph-node.js"
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { GSplatResource } from '../gsplat-resource.js'
 */

const localCameraPos = new Vec3();

/**
 * GSplatLod handles LOD management for a single splat.
 *
 * @ignore
 */
class GSplatLod {
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
        const maxTextureSize = this.device.maxTextureSize || 4096;
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

        // skip if resource doesn't have required data
        if (!resource.lodBlocks.blocksCenter || !resource.lodBlocks.blocksLodInfo) {
            return;
        }

        // Get camera position in world space
        const cameraPos = cameraNode.getWorldTransform().getTranslation();

        this.intervals.length = 0;
        const blockSize = resource.lodBlocks.blockSize;
        const numBlocks = resource.lodBlocks.numBlocks;

        // DEBUG: LOD distribution tracking per splat (can be removed for production)
        const lodCounts = [0, 0, 0]; // [lod0, lod1, lod2]

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

            // Assign LOD based on distance
            // < 5: LOD 0 (high detail), < 10: LOD 1 (medium), >= 10: LOD 2 (low detail)
            // TODO: make more generic and exposed
            let selectedLod;
            if (distance < 5) {
                selectedLod = 0;
            } else if (distance < 10) {
                selectedLod = 1;
            } else {
                selectedLod = 2;
            }

            // DEBUG: Count LOD usage per splat (can be removed for production)
            lodCounts[selectedLod]++;

            // Get splat counts for each LOD level
            const lodInfoBase = blockIdx * 3;
            const splatCount0 = resource.lodBlocks.blocksLodInfo[lodInfoBase + 0];     // LOD 0 splats
            const splatCount1 = resource.lodBlocks.blocksLodInfo[lodInfoBase + 1];     // LOD 1 splats
            const splatCount2 = resource.lodBlocks.blocksLodInfo[lodInfoBase + 2];     // LOD 2 splats

            // Calculate block base offset
            const blockBase = blockIdx * blockSize;

            // Create intervals based on selected LOD
            // Level 0: large splats (size > 0.01)
            // Level 1: medium splats
            // Level 2: small splats (size < 0.005)
            if (selectedLod === 0) {
                // Close distance: show all splats (large + medium + small)
                if (splatCount0 + splatCount1 + splatCount2 > 0) {
                    const start = blockBase;
                    const end = blockBase + splatCount0 + splatCount1 + splatCount2;
                    this.intervals.push(start, end);
                }
            } else if (selectedLod === 1) {
                // Medium distance: show large and medium splats (skip small)
                if (splatCount0 + splatCount1 > 0) {
                    const start = blockBase;
                    const end = blockBase + splatCount0 + splatCount1;  // Skip small splats
                    this.intervals.push(start, end);
                }
            } else { // selectedLod === 2
                // Far distance: show only large splats
                if (splatCount0 > 0) {
                    const start = blockBase;
                    const end = blockBase + splatCount0;  // Only large splats
                    this.intervals.push(start, end);
                }
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

export { GSplatLod };
