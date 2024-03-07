import {
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE,
    shaderChunks,
    RenderPassShaderQuad,
    Texture,
    RenderTarget
} from "playcanvas";

const fs = /* glsl */ `
    uniform highp sampler2D uSceneDepthMap;
    uniform sampler2D sourceTexture;
    uniform sampler2D accumulationTexture;
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
            // This hack is needed on webgpu, which makes TAA to work but the resulting image is upside-down.
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
            vec4 historyColor = SampleTextureCatmullRom(TEXTURE_PASS(accumulationTexture), historyUv, textureSize);

        #else

            // single sample history, more blurry result
            vec4 historyColor = texture2D(accumulationTexture, historyUv);

        #endif

        // handle disocclusion by clamping the history color
        vec4 historyColorClamped = colorClamp(uv, historyColor);

        // handle history buffer outside of the frame
        float mixFactor = (historyUv.x < 0.0 || historyUv.x > 1.0 || historyUv.y < 0.0 || historyUv.y > 1.0) ?
            1.0 : 0.05;

        gl_FragColor = mix(historyColorClamped, srcColor, mixFactor);
    }
`;

class RenderPassTAA extends RenderPassShaderQuad {
    /**
     * The index of the accumulation texture to render to.
     *
     * @type {number}
     */
    accumulationIndex = 0;

    accumulationTexture = null;

    /**
     * @type {Texture[]}
     */
    accumulationTextures = [];

    /**
     * @type {RenderTarget[]}
     */
    accumulationRenderTargets = [];

    constructor(device, sourceTexture, cameraComponent) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.cameraComponent = cameraComponent;

        const defines = `
            #define QUALITY_HIGH
        `;
        const fsChunks = shaderChunks.sampleCatmullRomPS;
        this.shader = this.createQuadShader('TaaResolveShader', defines + fsChunks + fs);

        const { scope } = device;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.textureSizeId = scope.resolve('textureSize');
        this.textureSize = new Float32Array(2);
        this.accumulationTextureId = scope.resolve('accumulationTexture');
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

        // double buffered accumulation render target
        for (let i = 0; i < 2; ++i) {
            this.accumulationTextures[i] = new Texture(this.device, {
                name: `TAA-Accumulation-${i}`,
                width: 4,
                height: 4,
                format: this.sourceTexture.format,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });

            this.accumulationRenderTargets[i] = new RenderTarget({
                colorBuffer: this.accumulationTextures[i],
                depth: false
            });
        }

        this.accumulationTexture = this.accumulationTextures[0];
        this.init(this.accumulationRenderTargets[0], {
            resizeSource: this.sourceTexture
        });
    }

    before() {
        this.sourceTextureId.setValue(this.sourceTexture);
        this.accumulationTextureId.setValue(this.accumulationTextures[1 - this.accumulationIndex]);

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

        // swap source and destination accumulation texture
        this.accumulationIndex = 1 - this.accumulationIndex;
        this.accumulationTexture = this.accumulationTextures[this.accumulationIndex];
        this.renderTarget = this.accumulationRenderTargets[this.accumulationIndex];

        return this.accumulationTexture;
    }
}

export { RenderPassTAA };
