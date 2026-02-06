import { Texture } from '../../platform/graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R32U, PIXELFORMAT_RG32U, CULLFACE_NONE,
    SEMANTIC_POSITION,
    FRONTFACE_CCW
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import gsplatIntervalTextureGLSL from '../shader-lib/glsl/chunks/gsplat/frag/gsplatIntervalTexture.js';
import gsplatIntervalTextureWGSL from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatIntervalTexture.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Shader } from '../../platform/graphics/shader.js'
 */

/**
 * Manages the intervals texture generation for GSplat LOD system using GPU acceleration. A list of
 * intervals is provided to the update method, and the texture is generated on the GPU. The texture
 * is then used to map target indices to source splat indices.
 *
 * @ignore
 */
class GSplatIntervalTexture {
    /** @type {GraphicsDevice} */
    device;

    /**
     * Texture that maps target indices to source splat indices based on intervals
     *
     * @type {Texture|null}
     */
    texture = null;

    /**
     * Render target for the intervals texture
     *
     * @type {RenderTarget|null}
     */
    rt = null;

    /**
     * Texture that stores interval data (start + accumulated sum pairs) for GPU processing
     *
     * @type {Texture|null}
     */
    intervalsDataTexture = null;

    /**
     * Shader for generating intervals texture on GPU
     *
     * @type {Shader|null}
     */
    shader = null;

    /**
     * @param {GraphicsDevice} device - The graphics device
     */
    constructor(device) {
        this.device = device;
    }

    destroy() {
        this.texture?.destroy();
        this.texture = null;
        this.rt?.destroy();
        this.rt = null;
        this.intervalsDataTexture?.destroy();
        this.intervalsDataTexture = null;
        this.shader = null;
    }

    /**
     * Creates shader for GPU-based intervals texture generation
     */
    getShader() {
        if (!this.shader) {
            this.shader = ShaderUtils.createShader(this.device, {
                uniqueName: 'GSplatIntervalsShader',
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'quadVS',
                fragmentGLSL: gsplatIntervalTextureGLSL,
                fragmentWGSL: gsplatIntervalTextureWGSL,
                fragmentOutputTypes: ['uint']
            });
        }

        return this.shader;
    }

    /**
     * Creates a texture with specified parameters
     */
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
     * Updates the intervals texture based on provided intervals array
     *
     * @param {number[]} intervals - Array of intervals (start, end pairs)
     * @param {number} totalIntervalSplats - Total number of splats referenced by the intervals
     * @returns {number} The number of active splats
     */
    update(intervals, totalIntervalSplats) {

        // Calculate texture dimensions for output intervals texture
        const maxTextureSize = this.device.maxTextureSize;
        let textureWidth = Math.ceil(Math.sqrt(totalIntervalSplats));
        textureWidth = Math.min(textureWidth, maxTextureSize);
        const textureHeight = Math.ceil(totalIntervalSplats / textureWidth);

        // Create main intervals texture
        this.texture = this.createTexture('intervalsTexture', PIXELFORMAT_R32U, textureWidth, textureHeight);

        this.rt = new RenderTarget({
            colorBuffer: this.texture,
            depth: false
        });

        // Prepare intervals data with CPU prefix sum
        const numIntervals = intervals.length / 2;
        const dataTextureSize = Math.ceil(Math.sqrt(numIntervals));

        // Create intervals data texture
        this.intervalsDataTexture = this.createTexture('intervalsData', PIXELFORMAT_RG32U, dataTextureSize, dataTextureSize);

        // Compute intervals data with accumulated sums on CPU
        // TODO: consider doing this using compute shader on WebGPU
        const intervalsData = this.intervalsDataTexture.lock();
        let runningSum = 0;

        for (let i = 0; i < numIntervals; i++) {
            const start = intervals[i * 2];
            const end = intervals[i * 2 + 1];
            const intervalSize = end - start;
            runningSum += intervalSize;

            intervalsData[i * 2] = start;          // R: interval start
            intervalsData[i * 2 + 1] = runningSum; // G: accumulated sum
        }

        this.intervalsDataTexture.unlock();

        // Generate intervals texture on GPU
        const scope = this.device.scope;
        scope.resolve('uIntervalsTexture').setValue(this.intervalsDataTexture);
        scope.resolve('uNumIntervals').setValue(numIntervals);
        scope.resolve('uTextureWidth').setValue(textureWidth);
        scope.resolve('uActiveSplats').setValue(totalIntervalSplats);

        this.device.setCullMode(CULLFACE_NONE);
        this.device.setFrontFaceMode(FRONTFACE_CCW);
        this.device.setBlendState(BlendState.NOBLEND);
        this.device.setDepthState(DepthState.NODEPTH);

        drawQuadWithShader(this.device, this.rt, this.getShader());

        return totalIntervalSplats;
    }
}

export { GSplatIntervalTexture };
