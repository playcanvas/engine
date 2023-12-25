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
        vec3 contrastSaturationBrightness(vec3 color, float brt, float sat, float con)
        {
            color = color * brt;
            float grey = dot(color, vec3(0.3, 0.59, 0.11));
            color  = mix(vec3(grey), color, sat);
            return max(mix(vec3(0.5), color, con), 0.0);
        }
    
    #endif

    #ifdef VIGNETTE

        uniform vec4 vignetterParams;

        float vignette(vec2 uv) {

            float inner = vignetterParams.x;
            float outer = vignetterParams.y;
            float curvature = vignetterParams.z;
            float intensity = vignetterParams.w;

            // edge curvature
            vec2 curve = pow(abs(uv * 2.0 -1.0), vec2(1.0 / curvature));

            // distance to edge
            float edge = pow(length(curve), curvature);

            // gradient and intensity
            return 1.0 - intensity * smoothstep(inner, outer, edge);
        }        

    #endif

    #ifdef FRINGING

        uniform float fringingIntensity;

        vec3 fringing(vec2 uv, vec3 color) {

            // offset depends on the direction from the center, raised to power to make it stronger away from the center
            vec2 centerDistance = uv0 - 0.5;
            vec2 offset = fringingIntensity * pow(centerDistance, vec2(2.0, 2.0));

            color.r = texture2D(sceneTexture, uv0 - offset).r;
            color.b = texture2D(sceneTexture, uv0 + offset).b;
            return color;
        }

    #endif

    void main() {
        vec4 scene = texture2D(sceneTexture, uv0);
        vec3 result = scene.rgb;

        #ifdef FRINGING
            result = fringing(uv0, result);
        #endif

        #ifdef BLOOM
            vec3 bloom = texture2D(bloomTexture, uv0).rgb;
            result += bloom * bloomIntensity;
        #endif

        #ifdef GRADING
            result = contrastSaturationBrightness(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);
        #endif

        result = toneMap(result);

        #ifdef VIGNETTE
            result *= vignette(uv0);
        #endif

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

    _vignetteEnabled = false;

    vignetteInner = 0.5;

    vignetteOuter = 1.0;

    vignetteCurvature = 0.5;

    vignetteIntensity = 0.3;

    _fringingEnabled = false;

    fringingIntensity = 10;

    _key = '';

    constructor(graphicsDevice) {
        super(graphicsDevice);

        this.sceneTextureId = graphicsDevice.scope.resolve('sceneTexture');
        this.bloomTextureId = graphicsDevice.scope.resolve('bloomTexture');
        this.bloomIntensityId = graphicsDevice.scope.resolve('bloomIntensity');
        this.bcsId = graphicsDevice.scope.resolve('brightnessContrastSaturation');
        this.vignetterParamsId = graphicsDevice.scope.resolve('vignetterParams');
        this.fringingIntensityId = graphicsDevice.scope.resolve('fringingIntensity');
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

    set vignetteEnabled(value) {
        if (this._vignetteEnabled !== value) {
            this._vignetteEnabled = value;
            this._shaderDirty = true;
        }
    }

    get vignetteEnabled() {
        return this._vignetteEnabled;
    }

    set fringingEnabled(value) {
        if (this._fringingEnabled !== value) {
            this._fringingEnabled = value;
            this._shaderDirty = true;
        }
    }

    get fringingEnabled() {
        return this._fringingEnabled;
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
                `-${this.gradingEnabled ? 'grading' : 'nograding'}` +
                `-${this.vignetteEnabled ? 'vignette' : 'novignette'}` +
                `-${this.fringingEnabled ? 'fringing' : 'nofringing'}`;

            if (this._key !== key) {
                this._key = key;

                const defines =
                    (this.bloomTexture ? `#define BLOOM\n` : '') +
                    (this.gradingEnabled ? `#define GRADING\n` : '') +
                    (this.vignetteEnabled ? `#define VIGNETTE\n` : '') +
                    (this.fringingEnabled ? `#define FRINGING\n` : '');

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

        if (this._vignetteEnabled) {
            this.vignetterParamsId.setValue([this.vignetteInner, this.vignetteOuter, this.vignetteCurvature, this.vignetteIntensity]);
        }

        if (this._fringingEnabled) {
            // relative to a fixed texture resolution to preserve size regardless of the resolution
            this.fringingIntensityId.setValue(this.fringingIntensity / 1024);
        }

        super.execute();
    }
}

export { RenderPassCompose };
