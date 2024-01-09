import {
    FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE,
    BLENDEQUATION_ADD, BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT,
    Color,
    BlendState,
    RenderPassShaderQuad,
    Texture,
    RenderTarget
} from "playcanvas";

class RenderPassTAA extends RenderPassShaderQuad {
    /**
     * @type {Texture}
     */
    accumulationTexture;

    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;

        this.shader = this.createQuadShader('TaaResolveShader', `

            uniform sampler2D sourceTexture;
            varying vec2 uv0;

            void main()
            {
                vec4 src = texture2D(sourceTexture, uv0);
                gl_FragColor = src;
            }`
        );

        this.sourceTextureId = device.scope.resolve('sourceTexture');

        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT);

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

        const { device } = this;

        // create the accumulation render target
        const texture = new Texture(device, {
            name: 'TAA Accumulation Texture',
            width: 4,
            height: 4,
            format: this.sourceTexture.format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this.accumulationTexture = texture;

        const rt = new RenderTarget({
            colorBuffer: texture,
            depth: false
        });

        this.init(rt, {
            resizeSource: this.sourceTexture
        });

        // clear it to black initially
        this.setClearColor(Color.BLACK);
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);

        // TODO: add this to the parent class
        const blend = 0.05;
        this.device.setBlendColor(blend, blend, blend, blend);

        super.execute();

        // disable clearing
        this.setClearColor();
    }
}

export { RenderPassTAA };
