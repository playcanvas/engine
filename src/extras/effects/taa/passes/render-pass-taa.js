import {
    FILTER_LINEAR,
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../../../platform/graphics/constants.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { TONEMAP_LINEAR, TONEMAP_NONE } from '../../../../scene/constants.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';
import glslSampleCatmullRomPS from '../glsl/sample-catmull-rom-ps.js';
import wgslSampleCatmullRomPS from '../wgsl/sample-catmull-rom-ps.js';
import glsltaaResolvePS from '../glsl/resolve-ps.js';
import wgsltaaResolvePS from '../wgsl/resolve-ps.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';

/**
 * @import { CameraComponent } from '../../../../framework/components/camera/component.js'
 * @import { CameraFrameEffectDepth } from '../../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 */

/**
 * A render pass implementation of Temporal Anti-Aliasing (TAA).
 *
 * @category Graphics
 * @ignore
 */
class RenderPassTAA extends RenderPassShaderQuad {
    /**
     * The index of the history texture to render to.
     */
    historyIndex = 0;

    /**
     * @type {Texture}
     */
    historyTexture = null;

    /**
     * @type {Texture[]}
     */
    historyTextures = [];

    /**
     * @type {RenderTarget[]}
     */
    historyRenderTargets = [];

    /**
     * The texture the pass resolves, the scene of the frame. Use
     * {@link RenderPassTAA#setSourceTexture} to change it, which also sizes the history from it
     * when not upscaling.
     *
     * @type {Texture|null}
     */
    sourceTexture = null;

    /**
     * Whether the history has the resolution of the camera's render target rather than of the
     * source texture, accumulating the jittered frames rendered at a lower resolution into it.
     *
     * @type {boolean}
     */
    upscale = false;

    /**
     * The tone mapping the composition displays the resolved scene with. The history and the
     * current frame are blended at the exposure the scene is displayed with, and without tone
     * mapping, the composition applies no exposure.
     *
     * @type {number}
     */
    toneMapping = TONEMAP_LINEAR;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera, whose jitter and matrices the
     * resolve reprojects the history with.
     * @param {object} [options] - The options.
     * @param {boolean} [options.upscale] - Whether the history has the resolution of the camera's
     * render target, see {@link RenderPassTAA#upscale}. Defaults to false.
     * @param {number} [options.format] - The format of the history on a device which cannot render
     * to a half float format, normally the format of the scene. Defaults to
     * {@link PIXELFORMAT_RGBA8}.
     * @param {CameraFrameEffectDepth|null} [options.depth] - The scene depth the resolve reads. When
     * not given, the defines describing how it is stored are taken from the camera.
     */
    constructor(device, cameraComponent, options = {}) {
        super(device);
        this.cameraComponent = cameraComponent;
        this.upscale = options.upscale ?? false;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('sampleCatmullRomPS', glslSampleCatmullRomPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('sampleCatmullRomPS', wgslSampleCatmullRomPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('taaResolvePS', glsltaaResolvePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('taaResolvePS', wgsltaaResolvePS);

        const defines = new Map();
        defines.set('QUALITY_HIGH', true);
        if (this.upscale) {
            defines.set('TAA_UPSCALE', true);
        }

        // add defines needed for correct use of screenDepthPS chunk
        const { depth } = options;
        let depthKey;
        if (depth) {
            depth.defines.forEach((value, key) => defines.set(key, value));
            depthKey = depth.key;
        } else {
            depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);
        }

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `TaaResolveShader${this.upscale ? 'Upscale' : ''}${depthKey}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'taaResolvePS',
            fragmentDefines: defines
        });

        const { scope } = device;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.textureSizeId = scope.resolve('textureSize');
        this.textureSize = new Float32Array(2);
        this.historySizeId = scope.resolve('historySize');
        this.historySize = new Float32Array(2);
        this.historyTextureId = scope.resolve('historyTexture');
        this.viewProjPrevId = scope.resolve('matrix_viewProjectionPrevious');
        this.viewProjInvId = scope.resolve('matrix_viewProjectionInverse');
        this.jittersId = scope.resolve('jitters');
        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');
        this.exposureId = scope.resolve('exposure');
        this.taaExposureId = scope.resolve('taaExposure');

        this.setup(options.format ?? PIXELFORMAT_RGBA8);
    }

    destroy() {

        // both history buffers, the one rendered to this frame and the one read
        this.historyRenderTargets.forEach((renderTarget) => {
            renderTarget.destroyTextureBuffers();
            renderTarget.destroy();
        });
        this.historyRenderTargets.length = 0;
        this.historyTextures.length = 0;
        this.historyTexture = null;
        this.renderTarget = null;
        this.sourceTexture = null;

        super.destroy();
    }

    /**
     * @param {number} fallbackFormat - The format of the history when the device cannot render to
     * a half float format.
     * @private
     */
    setup(fallbackFormat) {

        // The history accumulates each frame with a small weight, and so needs at least half float
        // precision - in a lower precision format, such as the RG11B10 the scene often renders to,
        // the small steps towards the converged value round away, and the history stops converging.
        const format = this.device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true) ??
            fallbackFormat;

        // double buffered history render target
        for (let i = 0; i < 2; ++i) {
            this.historyTextures[i] = new Texture(this.device, {
                name: `TAA-History-${i}`,
                width: 4,
                height: 4,
                format,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });

            this.historyRenderTargets[i] = new RenderTarget({
                colorBuffer: this.historyTextures[i],
                depth: false
            });
        }

        // the history has the resolution of the source, set with setSourceTexture, or when
        // upscaling, of the render target the camera renders to - the back buffer when it has none
        this.historyTexture = this.historyTextures[0];
        this.init(this.historyRenderTargets[0], {
            resizeSource: this.upscale ? this.cameraComponent.renderTarget : null
        });
    }

    /**
     * Sets the texture the pass resolves, which changes when the scene is resolved by another pass
     * before this one. Unless upscaling, the history is sized from it.
     *
     * @param {Texture} texture - The texture.
     */
    setSourceTexture(texture) {
        this.sourceTexture = texture;
        if (!this.upscale) {
            this.options.resizeSource = texture;
        }
    }

    before() {
        const history = this.historyTextures[1 - this.historyIndex];
        this.sourceTextureId.setValue(this.sourceTexture);
        this.historyTextureId.setValue(history);

        this.textureSize[0] = this.sourceTexture.width;
        this.textureSize[1] = this.sourceTexture.height;
        this.textureSizeId.setValue(this.textureSize);

        // the size of the history read, which can differ from the one written on a frame it resizes
        this.historySize[0] = history.width;
        this.historySize[1] = history.height;
        this.historySizeId.setValue(this.historySize);

        const camera = this.cameraComponent.camera;
        this.viewProjPrevId.setValue(camera._viewProjPrevious.data);
        this.viewProjInvId.setValue(camera._viewProjInverse.data);
        this.jittersId.setValue(camera._jitters);

        this.cameraParamsId.setValue(camera.fillShaderParams(this.cameraParams));

        // the exposure the renderer set up for the camera, unless the composition applies none
        this.taaExposureId.setValue(this.toneMapping === TONEMAP_NONE ? 1 : (this.exposureId.value ?? 1));
    }

    /**
     * Swaps the history textures, once per frame before the pass renders.
     *
     * @returns {Texture} The history texture the pass renders to this frame.
     */
    update() {

        // swap source and destination history texture
        this.historyIndex = 1 - this.historyIndex;
        this.historyTexture = this.historyTextures[this.historyIndex];
        this.renderTarget = this.historyRenderTargets[this.historyIndex];

        return this.historyTexture;
    }
}

export { RenderPassTAA };
