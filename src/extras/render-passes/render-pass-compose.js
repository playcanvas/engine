import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';
import { TONEMAP_LINEAR } from '../../scene/constants.js';
import { ShaderGenerator } from '../../scene/shader-lib/programs/shader-generator.js';


// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It's best to run it
// on a tone-mapped color buffer after post-processing, but before the UI, and so this is the
// obvious place to put it to avoid a separate render pass, even though we need to handle running it
// before the tone-mapping.

const fragmentShader = /* glsl */ `
    varying vec2 uv0;
    uniform sampler2D sceneTexture;
    uniform vec2 sceneTextureInvRes;

    #ifdef BLOOM
        uniform sampler2D bloomTexture;
        uniform float bloomIntensity;
    #endif

    #ifdef SSAO
        uniform sampler2D ssaoTexture;
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

    #ifdef CAS

        uniform float sharpness;

        // reversible LDR <-> HDR tone mapping, as CAS needs LDR input
        // based on: https://gpuopen.com/learn/optimized-reversible-tonemapper-for-resolve/
        float maxComponent(float x, float y, float z) { return max(x, max(y, z)); }
        vec3 toSDR(vec3 c) { return c / (1.0 + maxComponent(c.r, c.g, c.b)); }
        vec3 toHDR(vec3 c) { return c / (1.0 - maxComponent(c.r, c.g, c.b)); }

        vec3 cas(vec3 color, vec2 uv, float sharpness) {

            float x = sceneTextureInvRes.x;
            float y = sceneTextureInvRes.y;

            // sample 4 neighbors around the already sampled pixel, and convert it to SDR
            vec3 a = toSDR(texture2DLodEXT(sceneTexture, uv + vec2(0.0, -y), 0.0).rgb);
            vec3 b = toSDR(texture2DLodEXT(sceneTexture, uv + vec2(-x, 0.0), 0.0).rgb);
            vec3 c = toSDR(color.rgb);
            vec3 d = toSDR(texture2DLodEXT(sceneTexture, uv + vec2(x, 0.0), 0.0).rgb);
            vec3 e = toSDR(texture2DLodEXT(sceneTexture, uv + vec2(0.0, y), 0.0).rgb);

            // apply the sharpening
            float min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
            float max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
            float sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max_g);
            float w = sharpening_amount * sharpness;
            vec3 res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);

            // convert back to HDR
            return toHDR(res);
        }

    #endif

    void main() {

        vec2 uv = uv0;

        // TAA pass renders upside-down on WebGPU, flip it here
        #ifdef TAA
        #ifdef WEBGPU
            uv.y = 1.0 - uv.y;
        #endif
        #endif

        vec4 scene = texture2DLodEXT(sceneTexture, uv, 0.0);
        vec3 result = scene.rgb;

        #ifdef CAS
            result = cas(result, uv, sharpness);
        #endif

        #ifdef SSAO
            result *= texture2DLodEXT(ssaoTexture, uv0, 0.0).r;
        #endif

        #ifdef FRINGING
            result = fringing(uv, result);
        #endif

        #ifdef BLOOM
            vec3 bloom = texture2DLodEXT(bloomTexture, uv, 0.0).rgb;
            result += bloom * bloomIntensity;
        #endif

        #ifdef GRADING
            result = contrastSaturationBrightness(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);
        #endif

        result = toneMap(result);

        #ifdef VIGNETTE
            result *= vignette(uv);
        #endif

        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;

/**
 * Render pass implementation of the final post-processing composition.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassCompose extends RenderPassShaderQuad {
    sceneTexture = null;

    bloomIntensity = 0.01;

    _bloomTexture = null;

    _ssaoTexture = null;

    _toneMapping = TONEMAP_LINEAR;

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

    _taaEnabled = false;

    _sharpness = 0.5;

    _key = '';

    constructor(graphicsDevice) {
        super(graphicsDevice);

        const { scope } = graphicsDevice;
        this.sceneTextureId = scope.resolve('sceneTexture');
        this.bloomTextureId = scope.resolve('bloomTexture');
        this.ssaoTextureId = scope.resolve('ssaoTexture');
        this.bloomIntensityId = scope.resolve('bloomIntensity');
        this.bcsId = scope.resolve('brightnessContrastSaturation');
        this.vignetterParamsId = scope.resolve('vignetterParams');
        this.fringingIntensityId = scope.resolve('fringingIntensity');
        this.sceneTextureInvResId = scope.resolve('sceneTextureInvRes');
        this.sceneTextureInvResValue = new Float32Array(2);
        this.sharpnessId = scope.resolve('sharpness');
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

    set ssaoTexture(value) {
        if (this._ssaoTexture !== value) {
            this._ssaoTexture = value;
            this._shaderDirty = true;
        }
    }

    get ssaoTexture() {
        return this._ssaoTexture;
    }

    set taaEnabled(value) {
        if (this._taaEnabled !== value) {
            this._taaEnabled = value;
            this._shaderDirty = true;
        }
    }

    get taaEnabled() {
        return this._taaEnabled;
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

    set sharpness(value) {
        if (this._sharpness !== value) {
            this._sharpness = value;
            this._shaderDirty = true;
        }
    }

    get sharpness() {
        return this._sharpness;
    }

    get isSharpnessEnabled() {
        return this._sharpness > 0;
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
                `-${this.ssaoTexture ? 'ssao' : 'nossao'}` +
                `-${this.gradingEnabled ? 'grading' : 'nograding'}` +
                `-${this.vignetteEnabled ? 'vignette' : 'novignette'}` +
                `-${this.fringingEnabled ? 'fringing' : 'nofringing'}` +
                `-${this.taaEnabled ? 'taa' : 'notaa'}` +
                `-${this.isSharpnessEnabled ? 'cas' : 'nocas'}`;

            if (this._key !== key) {
                this._key = key;

                const defines =
                    (this.bloomTexture ? `#define BLOOM\n` : '') +
                    (this.ssaoTexture ? `#define SSAO\n` : '') +
                    (this.gradingEnabled ? `#define GRADING\n` : '') +
                    (this.vignetteEnabled ? `#define VIGNETTE\n` : '') +
                    (this.fringingEnabled ? `#define FRINGING\n` : '') +
                    (this.taaEnabled ? `#define TAA\n` : '') +
                    (this.isSharpnessEnabled ? `#define CAS\n` : '');

                const fsChunks =
                shaderChunks.decodePS +
                shaderChunks.gamma2_2PS +
                ShaderGenerator.tonemapCode(this.toneMapping);

                this.shader = this.createQuadShader(`ComposeShader-${key}`, defines + fsChunks + fragmentShader);
            }
        }
    }

    execute() {

        this.sceneTextureId.setValue(this.sceneTexture);
        this.sceneTextureInvResValue[0] = 1.0 / this.sceneTexture.width;
        this.sceneTextureInvResValue[1] = 1.0 / this.sceneTexture.height;
        this.sceneTextureInvResId.setValue(this.sceneTextureInvResValue);

        if (this._bloomTexture) {
            this.bloomTextureId.setValue(this._bloomTexture);
            this.bloomIntensityId.setValue(this.bloomIntensity);
        }

        if (this._ssaoTexture) {
            this.ssaoTextureId.setValue(this._ssaoTexture);
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

        if (this.isSharpnessEnabled) {
            this.sharpnessId.setValue(math.lerp(-0.125, -0.2, this.sharpness));
        }

        super.execute();
    }
}

export { RenderPassCompose };
