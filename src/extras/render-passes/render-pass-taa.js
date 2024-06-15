import {
    FILTER_LINEAR,
    ADDRESS_CLAMP_TO_EDGE
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';

const fs = /* glsl */ `
    uniform highp sampler2D uSceneDepthMap;
    uniform sampler2D sourceTexture;
    uniform sampler2D historyTexture;
    uniform mat4 matrix_viewProjectionPrevious;
    uniform mat4 matrix_viewProjectionInverse;
    uniform vec4 jitters;   // xy: current frame, zw: previous frame
    uniform vec2 textureSize;

    varying vec2 uv0;

    vec2 reproject(vec2 uv, float depth) {

        // fragment NDC
        #ifndef WEBGPU
            depth = depth * 2.0 - 1.0;
        #endif
        vec4 ndc = vec4(uv * 2.0 - 1.0, depth, 1.0);

        // remove jitter from the current frame
        ndc.xy -= jitters.xy;

        // Transform NDC to world space of the current frame
        vec4 worldPosition = matrix_viewProjectionInverse * ndc;
        worldPosition /= worldPosition.w;
    
        // world position to screen space of the previous frame
        vec4 screenPrevious = matrix_viewProjectionPrevious * worldPosition;

        return (screenPrevious.xy / screenPrevious.w) * 0.5 + 0.5;
    }

    vec4 colorClamp(vec2 uv, vec4 historyColor) {

        // out of range numbers
        vec3 minColor = vec3(9999.0);
        vec3 maxColor = vec3(-9999.0);
 
        // sample a 3x3 neighborhood to create a box in color space
        for(float x = -1.0; x <= 1.0; ++x)
        {
            for(float y = -1.0; y <= 1.0; ++y)
            {
                vec3 color = texture2D(sourceTexture, uv + vec2(x, y) / textureSize).rgb;
                minColor = min(minColor, color);
                maxColor = max(maxColor, color);
            }
        }
 
        // clamp the history color to min/max bounding box
        vec3 clamped = clamp(historyColor.rgb, minColor, maxColor);
        return vec4(clamped, historyColor.a);
    }

    void main()
    {
        vec2 uv = uv0;

        #ifdef WEBGPU
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // This hack is needed on webgpu, which makes TAA work but the resulting image is upside-down.
            // We could flip the image in the following pass, but ideally a better solution should be found.
            uv.y = 1.0 - uv.y;
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        #endif

        // current frame
        vec4 srcColor = texture2D(sourceTexture, uv);

        // current depth
        float depth = texture2DLodEXT(uSceneDepthMap, uv, 0.0).r;

        // previous frame
        vec2 historyUv = reproject(uv0, depth);

        #ifdef QUALITY_HIGH

            // high quality history, sharper result
            vec4 historyColor = SampleTextureCatmullRom(TEXTURE_PASS(historyTexture), historyUv, textureSize);

        #else

            // single sample history, more blurry result
            vec4 historyColor = texture2D(historyTexture, historyUv);

        #endif

        // handle disocclusion by clamping the history color
        vec4 historyColorClamped = colorClamp(uv, historyColor);

        // handle history buffer outside of the frame
        float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?
            1.0 : 0.05;

        gl_FragColor = mix(historyColorClamped, srcColor, mixFactor);
    }
`;

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

        const defines = /* glsl */`
            #define QUALITY_HIGH
        `;
        const fsChunks = shaderChunks.sampleCatmullRomPS;
        this.shader = this.createQuadShader('TaaResolveShader', defines + fsChunks + fs);

        const { scope } = device;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.textureSizeId = scope.resolve('textureSize');
        this.textureSize = new Float32Array(2);
        this.historyTextureId = scope.resolve('historyTexture');
        this.viewProjPrevId = scope.resolve('matrix_viewProjectionPrevious');
        this.viewProjInvId = scope.resolve('matrix_viewProjectionInverse');
        this.jittersId = scope.resolve('jitters');

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
