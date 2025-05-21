import {
    FILTER_LINEAR,
    ADDRESS_CLAMP_TO_EDGE,
    SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslSampleCatmullRomPS from '../../scene/shader-lib/chunks-glsl/render-pass/frag/sampleCatmullRom.js';
import wgslSampleCatmullRomPS from '../../scene/shader-lib/chunks-wgsl/render-pass/frag/sampleCatmullRom.js';
import glsltaaResolvePS from '../../scene/shader-lib/chunks-glsl/render-pass/frag/taaResolve.js';
import wgsltaaResolvePS from '../../scene/shader-lib/chunks-wgsl/render-pass/frag/taaResolve.js';
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
     *
     * @type {number}
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
        ShaderUtils.addScreenDepthChunkDefines(device, cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'TaaResolveShader',
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

        // double buffered history render target
        for (let i = 0; i < 2; ++i) {
            this.historyTextures[i] = new Texture(this.device, {
                name: `TAA-History-${i}`,
                width: 4,
                height: 4,
                format: this.sourceTexture.format,
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

        const f = camera._farClip;
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = camera._nearClip;
        this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
        this.cameraParamsId.setValue(this.cameraParams);
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
