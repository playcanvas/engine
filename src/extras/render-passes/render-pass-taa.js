import {
    FILTER_LINEAR,
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_RGBA16F,
    PIXELFORMAT_RGBA32F,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslSampleCatmullRomPS from './glsl/sample-catmull-rom-ps.js';
import wgslSampleCatmullRomPS from './wgsl/sample-catmull-rom-ps.js';
import glsltaaResolvePS from './glsl/taa-resolve-ps.js';
import wgsltaaResolvePS from './wgsl/taa-resolve-ps.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

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

    constructor(device, sourceTexture, cameraComponent) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('sampleCatmullRomPS', glslSampleCatmullRomPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('sampleCatmullRomPS', wgslSampleCatmullRomPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('taaResolvePS', glsltaaResolvePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('taaResolvePS', wgsltaaResolvePS);

        const defines = new Map();
        defines.set('QUALITY_HIGH', true);

        // add defines needed for correct use of screenDepthPS chunk
        const depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `TaaResolveShader${depthKey}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'taaResolvePS',
            fragmentDefines: defines
        });

        const { scope } = device;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.textureSizeId = scope.resolve('textureSize');
        this.textureSize = new Float32Array(2);
        this.historyTextureId = scope.resolve('historyTexture');
        this.viewProjPrevId = scope.resolve('matrix_viewProjectionPrevious');
        this.viewProjInvId = scope.resolve('matrix_viewProjectionInverse');
        this.jittersId = scope.resolve('jitters');
        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');

        this.setup();
    }

    destroy() {
        if (this.renderTarget) {
            this.renderTarget.destroyTextureBuffers();
            this.renderTarget.destroy();
            this.renderTarget = null;
        }
    }

    setup() {

        // The history accumulates each frame with a small weight, and so needs at least half float
        // precision - in a lower precision format, such as the RG11B10 the scene often renders to,
        // the small steps towards the converged value round away, and the history stops converging.
        const format = this.device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true) ??
            this.sourceTexture.format;

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

        this.historyTexture = this.historyTextures[0];
        this.init(this.historyRenderTargets[0], {
            resizeSource: this.sourceTexture
        });
    }

    before() {
        this.sourceTextureId.setValue(this.sourceTexture);
        this.historyTextureId.setValue(this.historyTextures[1 - this.historyIndex]);

        this.textureSize[0] = this.sourceTexture.width;
        this.textureSize[1] = this.sourceTexture.height;
        this.textureSizeId.setValue(this.textureSize);

        const camera = this.cameraComponent.camera;
        this.viewProjPrevId.setValue(camera._viewProjPrevious.data);
        this.viewProjInvId.setValue(camera._viewProjInverse.data);
        this.jittersId.setValue(camera._jitters);

        this.cameraParamsId.setValue(camera.fillShaderParams(this.cameraParams));
    }

    // called when the parent render pass gets added to the frame graph
    update() {

        // swap source and destination history texture
        this.historyIndex = 1 - this.historyIndex;
        this.historyTexture = this.historyTextures[this.historyIndex];
        this.renderTarget = this.historyRenderTargets[this.historyIndex];

        return this.historyTexture;
    }
}

export { RenderPassTAA };
