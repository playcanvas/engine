import { Color } from '../../../../core/math/color.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RG8, PIXELFORMAT_RGBA8, SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../../../platform/graphics/constants.js';
import { FramePass } from '../../../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { TONEMAP_LINEAR, TONEMAP_NONE } from '../../../../scene/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';
import glslBlendPS from '../glsl/blend-ps.js';
import glslEdgePS from '../glsl/edge-ps.js';
import glslWeightsPS from '../glsl/weights-ps.js';
import wgslBlendPS from '../wgsl/blend-ps.js';
import wgslEdgePS from '../wgsl/edge-ps.js';
import wgslWeightsPS from '../wgsl/weights-ps.js';

/**
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { ScopeId } from '../../../../platform/graphics/scope-id.js'
 */

// the edge and the weight targets are cleared, the pixels without an edge left as they are
const clearColor = new Color(0, 0, 0, 0);

/**
 * One of the passes of SMAA, rendering a full screen quad with the textures and the parameters it
 * reads.
 *
 * @ignore
 */
class RenderPassSmaa extends RenderPassShaderQuad {
    /**
     * The frame pass the pass belongs to, holding the scene and the parameters.
     *
     * @type {FramePassSmaa}
     */
    smaa;

    /**
     * The textures the pass reads, and the uniforms they are bound to.
     *
     * @type {{ scopeId: ScopeId, texture: Texture|null }[]}
     * @private
     */
    _textures = [];

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {FramePassSmaa} smaa - The frame pass the pass belongs to.
     * @param {string} name - The name of the pass, which its shader is named after.
     * @param {string} chunk - The name of the fragment shader chunk.
     */
    constructor(device, smaa, name, chunk) {
        super(device);
        this.name = `RenderPassSmaa${name}`;
        this.smaa = smaa;
        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `SmaaShader${name}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: chunk
        });
    }

    /**
     * Sets the texture bound to a uniform when the pass renders.
     *
     * @param {string} name - The name of the uniform.
     * @param {Texture|null} texture - The texture.
     */
    setTexture(name, texture) {
        let entry = this._textures.find(item => item.scopeId.name === name);
        if (!entry) {
            entry = { scopeId: this.device.scope.resolve(name), texture: null };
            this._textures.push(entry);
        }
        entry.texture = texture;
    }

    execute() {
        const textures = this._textures;
        for (let i = 0; i < textures.length; i++) {
            textures[i].scopeId.setValue(textures[i].texture);
        }
        this.smaa.bindParameters();
        super.execute();
    }

    destroy() {
        this._textures.length = 0;
        super.destroy();
    }
}

/**
 * Subpixel Morphological Anti-Aliasing (SMAA 1x), in three passes over the scene: the edges are
 * detected, the area each pixel on an edge would be covered by the edge before it was aliased is
 * looked up from the shape of the edge, and the pixels are blended with their neighbours by those
 * areas into a new scene texture.
 *
 * @ignore
 */
class FramePassSmaa extends FramePass {
    /**
     * The edge brightness difference threshold.
     *
     * @type {number}
     */
    threshold = 0.1;

    /**
     * The maximum number of steps searching for the end of a horizontal or vertical edge.
     *
     * @type {number}
     */
    maxSearchSteps = 16;

    /**
     * The maximum number of steps searching for the end of a diagonal edge. Zero disables the
     * diagonal edges.
     *
     * @type {number}
     */
    maxSearchStepsDiag = 8;

    /**
     * How much the sharp corners are rounded, 0-100.
     *
     * @type {number}
     */
    cornerRounding = 25;

    /**
     * The tone mapping the composition displays the resolved scene with. The edges are detected,
     * and the pixels blended, at the exposure the scene is displayed with, and without tone
     * mapping, the composition applies no exposure.
     *
     * @type {number}
     */
    toneMapping = TONEMAP_LINEAR;

    /**
     * The scene the passes read, set with {@link FramePassSmaa#setSourceTexture}.
     *
     * @type {Texture|null}
     */
    sourceTexture = null;

    /** @type {RenderTarget} */
    edgesTarget;

    /** @type {RenderTarget} */
    weightsTarget;

    /** @type {RenderTarget} */
    outputTarget;

    /** @private */
    _metrics = new Float32Array(4);

    /** @private */
    _params = new Float32Array(4);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} format - The format of the scene texture the passes render, that of the
     * scene.
     * @param {Texture} areaTexture - The area lookup texture.
     * @param {Texture} searchTexture - The search lookup texture.
     */
    constructor(device, format, areaTexture, searchTexture) {
        super(device);

        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('smaaEdgePS', glslEdgePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('smaaEdgePS', wgslEdgePS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('smaaWeightsPS', glslWeightsPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('smaaWeightsPS', wgslWeightsPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('smaaBlendPS', glslBlendPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('smaaBlendPS', wgslBlendPS);

        this.edgesTarget = this.createTarget('SmaaEdges', PIXELFORMAT_RG8);
        this.weightsTarget = this.createTarget('SmaaWeights', PIXELFORMAT_RGBA8);
        this.outputTarget = this.createTarget('SmaaOutput', format);

        const { scope } = device;
        this._metricsId = scope.resolve('smaaMetrics');
        this._paramsId = scope.resolve('smaaParams');
        this._exposureId = scope.resolve('exposure');
        this._smaaExposureId = scope.resolve('smaaExposure');

        // the passes render at the size of the scene, the texture they are resized from set every
        // frame - see setSourceTexture
        const options = () => ({ resizeSource: null });

        // the edges of the scene
        const edgePass = new RenderPassSmaa(device, this, 'Edge', 'smaaEdgePS');
        edgePass.init(this.edgesTarget, options());
        edgePass.setClearColor(clearColor);

        // the areas the pixels on the edges blend with their neighbours by
        const weightsPass = new RenderPassSmaa(device, this, 'Weights', 'smaaWeightsPS');
        weightsPass.init(this.weightsTarget, options());
        weightsPass.setClearColor(clearColor);
        weightsPass.setTexture('smaaEdgesTexture', this.edgesTarget.colorBuffer);
        weightsPass.setTexture('smaaAreaTexture', areaTexture);
        weightsPass.setTexture('smaaSearchTexture', searchTexture);

        // the scene blended by them
        const blendPass = new RenderPassSmaa(device, this, 'Blend', 'smaaBlendPS');
        blendPass.init(this.outputTarget, options());
        blendPass.setTexture('smaaBlendTexture', this.weightsTarget.colorBuffer);

        this.edgePass = edgePass;
        this.weightsPass = weightsPass;
        this.blendPass = blendPass;
        this.beforePasses = [edgePass, weightsPass, blendPass];
    }

    /**
     * @param {string} name - The name of the target.
     * @param {number} format - The format of its texture.
     * @returns {RenderTarget} The render target, without depth.
     * @private
     */
    createTarget(name, format) {
        return new RenderTarget({
            name,
            colorBuffer: new Texture(this.device, {
                name,
                width: 4,
                height: 4,
                format,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            }),
            depth: false
        });
    }

    /**
     * The texture the passes render the anti-aliased scene to.
     *
     * @type {Texture}
     */
    get outputTexture() {
        return this.outputTarget.colorBuffer;
    }

    /**
     * The texture holding the edges, for the debug view.
     *
     * @type {Texture}
     */
    get edgesTexture() {
        return this.edgesTarget.colorBuffer;
    }

    /**
     * The texture holding the blending weights, for the debug view.
     *
     * @type {Texture}
     */
    get weightsTexture() {
        return this.weightsTarget.colorBuffer;
    }

    /**
     * Sets the scene the passes read, which they are also sized from. Set every frame, as the
     * scene resolved before can change from frame to frame.
     *
     * @param {Texture} texture - The scene texture.
     */
    setSourceTexture(texture) {
        this.sourceTexture = texture;
        this.edgePass.setTexture('smaaColorTexture', texture);
        this.blendPass.setTexture('smaaColorTexture', texture);
        for (let i = 0; i < this.beforePasses.length; i++) {
            this.beforePasses[i].options.resizeSource = texture;
        }
    }

    /**
     * Binds the size of the scene and the parameters, for the passes rendering.
     *
     * @ignore
     */
    bindParameters() {
        const { width, height } = this.sourceTexture;
        const metrics = this._metrics;
        metrics[0] = 1 / width;
        metrics[1] = 1 / height;
        metrics[2] = width;
        metrics[3] = height;
        this._metricsId.setValue(metrics);

        const params = this._params;
        params[0] = this.threshold;
        params[1] = this.maxSearchSteps;
        params[2] = this.maxSearchStepsDiag;
        params[3] = this.cornerRounding / 100;
        this._paramsId.setValue(params);

        // the exposure the renderer set up for the camera, unless the composition applies none
        this._smaaExposureId.setValue(this.toneMapping === TONEMAP_NONE ? 1 : (this._exposureId.value ?? 1));
    }

    destroy() {
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;
        [this.edgesTarget, this.weightsTarget, this.outputTarget].forEach((target) => {
            target.destroyTextureBuffers();
            target.destroy();
        });
        this.sourceTexture = null;

        super.destroy();
    }
}

export { FramePassSmaa };
