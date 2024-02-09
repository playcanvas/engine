import {
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE,
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

    varying vec2 uv0;

    vec2 reproject(vec2 uv, float depth) {

        // fragment NDC
        #ifndef WEBGPU
            depth = depth * 2.0 - 1.0;
        #endif
        vec4 ndc = vec4(uv * 2.0 - 1.0, depth, 1.0);

        // Transform NDC to world space of the current frame
        vec4 worldPosition = matrix_viewProjectionInverse * ndc;
        worldPosition /= worldPosition.w;
    
        // world position to screen space of the previous frame
        vec4 screenPrevious = matrix_viewProjectionPrevious * worldPosition;
        return (screenPrevious.xy / screenPrevious.w) * 0.5 + 0.5;
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
        vec4 src = texture2D(sourceTexture, uv);

        // current depth
        float depth = texture2DLodEXT(uSceneDepthMap, uv, 0.0).r;

        // previous frame
        vec2 lastUv = reproject(uv0, depth);
        vec4 acc = texture2D(accumulationTexture, lastUv);

        // handle history buffer outside of the frame
        if (lastUv.x < 0.0 || lastUv.x > 1.0 || lastUv.y < 0.0 || lastUv.y > 1.0) {
            gl_FragColor = src;
        } else {
            gl_FragColor = mix(acc, src, 0.05);
        }
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

        this.shader = this.createQuadShader('TaaResolveShader', fs);

        const { scope } = device;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.accumulationTextureId = scope.resolve('accumulationTexture');
        this.viewProjPrevId = scope.resolve('matrix_viewProjectionPrevious');
        this.viewProjInvId = scope.resolve('matrix_viewProjectionInverse');

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

        const camera = this.cameraComponent.camera;
        this.viewProjPrevId.setValue(camera._viewProjPrevious.data);
        this.viewProjInvId.setValue(camera._viewProjInverse.data);
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
