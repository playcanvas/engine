import {
    Color,
    RenderPassShaderQuad,
    shaderChunks,
    TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2
} from "playcanvas";

const fragmentShader = `
    uniform sampler2D sceneTexture;
    uniform sampler2D bloomTexture;
    uniform float bloomIntensity;
    varying vec2 uv0;
    void main() {
        vec4 scene = texture2D(sceneTexture, uv0);
        vec3 bloom = texture2D(bloomTexture, uv0).rgb;

        vec3 result = scene.rgb;
        result += bloom * bloomIntensity;
        result = toneMap(result);
        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;

class RenderPassCompose extends RenderPassShaderQuad {
    bloomIntensity = 0.01;

    _toneMapping = TONEMAP_ACES2;

    _shaderDirty = true;

    _key = '';

    constructor(graphicsDevice) {
        super(graphicsDevice);

        this.sceneTextureId = graphicsDevice.scope.resolve('sceneTexture');
        this.bloomTextureId = graphicsDevice.scope.resolve('bloomTexture');
        this.bloomIntensityId = graphicsDevice.scope.resolve('bloomIntensity');
    }

    set toneMapping(value) {
        if (this._toneMapping !== value) {
            this._toneMapping = value;
            this._shaderDirty = true;
        }
    }

    get toneMapping() {
        return this._toneMapping;
    }

    get toneMapChunk() {
        switch (this.toneMapping) {
            case TONEMAP_LINEAR: return shaderChunks.tonemappingLinearPS;
            case TONEMAP_FILMIC: return shaderChunks.tonemappingFilmicPS;
            case TONEMAP_HEJL: return shaderChunks.tonemappingHejlPS;
            case TONEMAP_ACES: return shaderChunks.tonemappingAcesPS;
            case TONEMAP_ACES2: return shaderChunks.tonemappingAces2PS;
        }
        return shaderChunks.tonemappingNonePS;
    }

    postInit() {
        // clear all buffers to avoid them being loaded from memory
        this.setClearColor(Color.BLACK);
        this.setClearDepth(1.0);
        this.setClearStencil(0);
    }

    frameUpdate() {

        if (this._shaderDirty) {
            this._shaderDirty = false;

            const key = `${this.toneMapping}`;
            if (this._key !== key) {
                this._key = key;

                const fsChunks =
                shaderChunks.decodePS +
                shaderChunks.gamma2_2PS +
                this.toneMapChunk;

                this.shader = this.createQuadShader(`ComposeShader-${key}`, fsChunks + fragmentShader);
            }
        }
    }

    execute() {

        this.sceneTextureId.setValue(this.sceneTexture);
        this.bloomTextureId.setValue(this.bloomTexture);
        this.bloomIntensityId.setValue(this.bloomIntensity);

        super.execute();
    }
}

export { RenderPassCompose };
