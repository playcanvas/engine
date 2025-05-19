import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { SHADERLANGUAGE_GLSL } from '../../platform/graphics/constants.js';

// Contrast Adaptive Sharpening (CAS) is used to apply the sharpening. It's based on AMD's
// FidelityFX CAS, WebGL implementation: https://www.shadertoy.com/view/wtlSWB. It's best to run it
// on a tone-mapped color buffer after post-processing, but before the UI, and so this is the
// obvious place to put it to avoid a separate render pass, even though we need to handle running it
// before the tone-mapping.

const fragmentShader = /* glsl */ `

    #include "tonemappingPS"
    #include "gammaPS"

    varying vec2 uv0;
    uniform sampler2D sceneTexture;
    uniform vec2 sceneTextureInvRes;

    #ifdef BLOOM
        uniform sampler2D bloomTexture;
        uniform float bloomIntensity;
    #endif

    #ifdef DOF
        uniform sampler2D cocTexture;
        uniform sampler2D blurTexture;

        // Samples the DOF blur and CoC textures. When the blur texture was generated at lower resolution,
        // upscale it to the full resolution using bilinear interpolation to hide the blockiness along COC edges.
        vec3 dofBlur(vec2 uv, out vec2 coc) {
            coc = texture2DLod(cocTexture, uv, 0.0).rg;

            #if DOF_UPSCALE
                vec2 blurTexelSize = 1.0 / vec2(textureSize(blurTexture, 0));
                vec3 bilinearBlur = vec3(0.0);
                float totalWeight = 0.0;

                // 3x3 grid of neighboring texels
                for (int i = -1; i <= 1; i++) {
                    for (int j = -1; j <= 1; j++) {
                        vec2 offset = vec2(i, j) * blurTexelSize;
                        vec2 cocSample = texture2DLod(cocTexture, uv + offset, 0.0).rg;
                        vec3 blurSample = texture2DLod(blurTexture, uv + offset, 0.0).rgb;

                        // Accumulate the weighted blur sample
                        float cocWeight = clamp(cocSample.r + cocSample.g, 0.0, 1.0);
                        bilinearBlur += blurSample * cocWeight;
                        totalWeight += cocWeight;
                    }
                }

                // normalize the accumulated color
                if (totalWeight > 0.0) {
                    bilinearBlur /= totalWeight;
                }

                return bilinearBlur;
            #else
                // when blurTexture is full resolution, just sample it, no upsampling
                return texture2DLod(blurTexture, uv, 0.0).rgb;
            #endif
        }

    #endif

    #ifdef SSAO
        #define SSAO_TEXTURE
    #endif

    #if DEBUG_COMPOSE == ssao
        #define SSAO_TEXTURE
    #endif

    #ifdef SSAO_TEXTURE
        uniform sampler2D ssaoTexture;
    #endif

    #ifdef GRADING
        uniform vec3 brightnessContrastSaturation;
        uniform vec3 tint;

        // for all parameters, 1.0 is the no-change value
        vec3 colorGradingHDR(vec3 color, float brt, float sat, float con)
        {
            // tint
            color *= tint;

            // brightness
            color = color * brt;

            // saturation
            float grey = dot(color, vec3(0.3, 0.59, 0.11));
            grey = grey / max(1.0, max(color.r, max(color.g, color.b)));    // Normalize luminance in HDR to preserve intensity (optional)
            color = mix(vec3(grey), color, sat);

            // contrast
            return mix(vec3(0.5), color, con);
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
            vec2 centerDistance = uv - 0.5;
            vec2 offset = fringingIntensity * pow(centerDistance, vec2(2.0, 2.0));

            color.r = texture2D(sceneTexture, uv - offset).r;
            color.b = texture2D(sceneTexture, uv + offset).b;
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
            vec3 a = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, -y), 0.0).rgb);
            vec3 b = toSDR(texture2DLod(sceneTexture, uv + vec2(-x, 0.0), 0.0).rgb);
            vec3 c = toSDR(color.rgb);
            vec3 d = toSDR(texture2DLod(sceneTexture, uv + vec2(x, 0.0), 0.0).rgb);
            vec3 e = toSDR(texture2DLod(sceneTexture, uv + vec2(0.0, y), 0.0).rgb);

            // apply the sharpening
            float min_g = min(a.g, min(b.g, min(c.g, min(d.g, e.g))));
            float max_g = max(a.g, max(b.g, max(c.g, max(d.g, e.g))));
            float sharpening_amount = sqrt(min(1.0 - max_g, min_g) / max_g);
            float w = sharpening_amount * sharpness;
            vec3 res = (w * (a + b + d + e) + c) / (4.0 * w + 1.0);

            // remove negative colors
            res = max(res, 0.0);

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

        vec4 scene = texture2DLod(sceneTexture, uv, 0.0);
        vec3 result = scene.rgb;

        #ifdef CAS
            result = cas(result, uv, sharpness);
        #endif

        #ifdef DOF
            vec2 coc;
            vec3 blur = dofBlur(uv0, coc);
            result = mix(result, blur, coc.r + coc.g);
        #endif

        #ifdef SSAO_TEXTURE
            mediump float ssao = texture2DLod(ssaoTexture, uv0, 0.0).r;
        #endif

        #ifdef SSAO
            result *= ssao;
        #endif

        #ifdef FRINGING
            result = fringing(uv, result);
        #endif

        #ifdef BLOOM
            vec3 bloom = texture2DLod(bloomTexture, uv0, 0.0).rgb;
            result += bloom * bloomIntensity;
        #endif

        #ifdef GRADING
            // color grading takes place in HDR space before tone mapping
            result = colorGradingHDR(result, brightnessContrastSaturation.x, brightnessContrastSaturation.z, brightnessContrastSaturation.y);
        #endif

        result = toneMap(result);

        #ifdef VIGNETTE
            mediump float vig = vignette(uv);
            result *= vig;
        #endif

        // debug output
        #ifdef DEBUG_COMPOSE

            #ifdef BLOOM
                #if DEBUG_COMPOSE == bloom
                    result = bloom * bloomIntensity;
                #endif
            #endif

            #ifdef DOF
                #ifdef DEBUG_COMPOSE == dofcoc
                    result = vec3(coc, 0.0);
                #endif
                #ifdef DEBUG_COMPOSE == dofblur
                    result = blur;
                #endif
            #endif

            #if DEBUG_COMPOSE == ssao
                result = vec3(ssao);
            #endif

            #if DEBUG_COMPOSE == vignette
                result = vec3(vig);
            #endif

            #if DEBUG_COMPOSE == scene
                result = scene.rgb;
            #endif

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

    _cocTexture = null;

    blurTexture = null;

    blurTextureUpscale = false;

    _ssaoTexture = null;

    _toneMapping = TONEMAP_LINEAR;

    _gradingEnabled = false;

    gradingSaturation = 1;

    gradingContrast = 1;

    gradingBrightness = 1;

    gradingTint = new Color(1, 1, 1, 1);

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

    _gammaCorrection = GAMMA_SRGB;

    _key = '';

    _debug = null;

    constructor(graphicsDevice) {
        super(graphicsDevice);

        const { scope } = graphicsDevice;
        this.sceneTextureId = scope.resolve('sceneTexture');
        this.bloomTextureId = scope.resolve('bloomTexture');
        this.cocTextureId = scope.resolve('cocTexture');
        this.ssaoTextureId = scope.resolve('ssaoTexture');
        this.blurTextureId = scope.resolve('blurTexture');
        this.bloomIntensityId = scope.resolve('bloomIntensity');
        this.bcsId = scope.resolve('brightnessContrastSaturation');
        this.tintId = scope.resolve('tint');
        this.vignetterParamsId = scope.resolve('vignetterParams');
        this.fringingIntensityId = scope.resolve('fringingIntensity');
        this.sceneTextureInvResId = scope.resolve('sceneTextureInvRes');
        this.sceneTextureInvResValue = new Float32Array(2);
        this.sharpnessId = scope.resolve('sharpness');
    }

    set debug(value) {
        if (this._debug !== value) {
            this._debug = value;
            this._shaderDirty = true;
        }
    }

    get debug() {
        return this._debug;
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

    set cocTexture(value) {
        if (this._cocTexture !== value) {
            this._cocTexture = value;
            this._shaderDirty = true;
        }
    }

    get cocTexture() {
        return this._cocTexture;
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

        // detect if the render target is srgb vs execute manual srgb conversion
        const rt = this.renderTarget ?? this.device.backBuffer;
        const srgb = rt.isColorBufferSrgb(0);
        const neededGammaCorrection = srgb ? GAMMA_NONE : GAMMA_SRGB;
        if (this._gammaCorrection !== neededGammaCorrection) {
            this._gammaCorrection = neededGammaCorrection;
            this._shaderDirty = true;
        }

        // need to rebuild shader
        if (this._shaderDirty) {
            this._shaderDirty = false;

            const gammaCorrectionName = gammaNames[this._gammaCorrection];

            const key =
                `${this.toneMapping}` +
                `-${gammaCorrectionName}` +
                `-${this.bloomTexture ? 'bloom' : 'nobloom'}` +
                `-${this.cocTexture ? 'dof' : 'nodof'}` +
                `-${this.blurTextureUpscale ? 'dofupscale' : ''}` +
                `-${this.ssaoTexture ? 'ssao' : 'nossao'}` +
                `-${this.gradingEnabled ? 'grading' : 'nograding'}` +
                `-${this.vignetteEnabled ? 'vignette' : 'novignette'}` +
                `-${this.fringingEnabled ? 'fringing' : 'nofringing'}` +
                `-${this.taaEnabled ? 'taa' : 'notaa'}` +
                `-${this.isSharpnessEnabled ? 'cas' : 'nocas'}` +
                `-${this._debug ?? ''}`;

            if (this._key !== key) {
                this._key = key;

                const defines = new Map();
                defines.set('TONEMAP', tonemapNames[this.toneMapping]);
                defines.set('GAMMA', gammaCorrectionName);
                if (this.bloomTexture) defines.set('BLOOM', true);
                if (this.cocTexture) defines.set('DOF', true);
                if (this.blurTextureUpscale) defines.set('DOF_UPSCALE', true);
                if (this.ssaoTexture) defines.set('SSAO', true);
                if (this.gradingEnabled) defines.set('GRADING', true);
                if (this.vignetteEnabled) defines.set('VIGNETTE', true);
                if (this.fringingEnabled) defines.set('FRINGING', true);
                if (this.taaEnabled) defines.set('TAA', true);
                if (this.isSharpnessEnabled) defines.set('CAS', true);
                if (this._debug) defines.set('DEBUG_COMPOSE', this._debug);

                const includes = new Map(ShaderChunks.get(this.device, SHADERLANGUAGE_GLSL));

                this.shader = this.createQuadShader(`ComposeShader-${key}`, fragmentShader, {
                    fragmentIncludes: includes,
                    fragmentDefines: defines
                });
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

        if (this._cocTexture) {
            this.cocTextureId.setValue(this._cocTexture);
            this.blurTextureId.setValue(this.blurTexture);
        }

        if (this._ssaoTexture) {
            this.ssaoTextureId.setValue(this._ssaoTexture);
        }

        if (this._gradingEnabled) {
            this.bcsId.setValue([this.gradingBrightness, this.gradingContrast, this.gradingSaturation]);
            this.tintId.setValue([this.gradingTint.r, this.gradingTint.g, this.gradingTint.b]);
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
