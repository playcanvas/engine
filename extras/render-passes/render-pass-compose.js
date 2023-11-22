import {
    Color,
    RenderPassShaderQuad,
    shaderChunks,
    TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2
} from "playcanvas";

const fragmentShader = `
    varying vec2 uv0;
    uniform sampler2D sceneTexture;

    #ifdef BLOOM
        uniform sampler2D bloomTexture;
        uniform float bloomIntensity;
    #endif

    #ifdef GRADING
        uniform vec3 brightnessContrastSaturation;

        // for all parameters, 1.0 is the no-change value
        vec3 ContrastSaturationBrightness(vec3 color, float brt, float sat, float con)
        {
            color = color * brt;
            float grey = dot(color, vec3(0.3, 0.59, 0.11));
            color  = mix(vec3(grey), color, sat);
            return max(mix(vec3(0.5), color, con), 0.0);
        }
    
    #endif

    void main() {
        vec4 scene = texture2D(sceneTexture, uv0);
        vec3 result = scene.rgb;

        #ifdef BLOOM
            vec3 bloom = texture2D(bloomTexture, uv0).rgb;
            result += bloom * bloomIntensity;
        #endif

        #ifdef GRADING
            result = ContrastSaturationBrightness(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);
        #endif

        result = toneMap(result);
        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;

class RenderPassCompose extends RenderPassShaderQuad {
    sceneTexture = null;

    bloomIntensity = 0.01;

    _bloomTexture = null;

    _toneMapping = TONEMAP_ACES2;

    _gradingEnabled = false;

    gradingSaturation = 1;

    gradingContrast = 1;

    gradingBrightness = 1;

    _shaderDirty = true;

    _key = '';

    constructor(graphicsDevice) {
        super(graphicsDevice);

        this.sceneTextureId = graphicsDevice.scope.resolve('sceneTexture');
        this.bloomTextureId = graphicsDevice.scope.resolve('bloomTexture');
        this.bloomIntensityId = graphicsDevice.scope.resolve('bloomIntensity');
        this.bcsId = graphicsDevice.scope.resolve('brightnessContrastSaturation');
    }

    set bloomTexture(value) {
        if (this._bloomTexture !== value) {
            this._bloomTexture = value;
            this._shaderDirty = true;
        }
    }

    get bloomTexture() {
        return this._bloomTexture;
    }

    set gradingEnabled(value) {
        if (this._gradingEnabled !== value) {
            this._gradingEnabled = value;
            this._shaderDirty = true;
        }
    }

    get gradingEnabled() {
        return this._gradingEnabled;
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

            const key = `${this.toneMapping}` +
                `-${this.bloomTexture ? 'bloom' : 'nobloom'}` +
                `-${this.gradingEnabled ? 'grading' : 'nograding'}`;

            if (this._key !== key) {
                this._key = key;

                const defines =
                    (this.bloomTexture ? `#define BLOOM\n` : '') +
                    (this.gradingEnabled ? `#define GRADING\n` : '');

                const fsChunks =
                shaderChunks.decodePS +
                shaderChunks.gamma2_2PS +
                this.toneMapChunk;

                this.shader = this.createQuadShader(`ComposeShader-${key}`, defines + fsChunks + fragmentShader);
            }
        }
    }

    execute() {

        this.sceneTextureId.setValue(this.sceneTexture);

        if (this._bloomTexture) {
            this.bloomTextureId.setValue(this._bloomTexture);
            this.bloomIntensityId.setValue(this.bloomIntensity);
        }

        if (this._gradingEnabled) {
            this.bcsId.setValue([this.gradingBrightness, this.gradingContrast, this.gradingSaturation]);
        }

        super.execute();
    }
}

export { RenderPassCompose };
