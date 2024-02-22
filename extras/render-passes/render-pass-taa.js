import {
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE,
    RenderPassShaderQuad,
    Texture,
    RenderTarget
} from "playcanvas";

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

    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;

        this.shader = this.createQuadShader('TaaResolveShader', `

            uniform sampler2D sourceTexture;
            uniform sampler2D accumulationTexture;
            varying vec2 uv0;

            void main()
            {
                vec4 src = texture2D(sourceTexture, uv0);
                vec4 acc = texture2D(accumulationTexture, uv0);
                gl_FragColor = mix(acc, src, 0.05);
            }`
        );

        this.sourceTextureId = device.scope.resolve('sourceTexture');
        this.accumulationTextureId = device.scope.resolve('accumulationTexture');

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

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);
        this.accumulationTextureId.setValue(this.accumulationTextures[1 - this.accumulationIndex]);

        super.execute();
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
