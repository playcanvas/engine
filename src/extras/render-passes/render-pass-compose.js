import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { hashCode } from '../../core/hash.js';
import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import { composeChunksGLSL } from '../../scene/shader-lib/glsl/collections/compose-chunks-glsl.js';
import { composeChunksWGSL } from '../../scene/shader-lib/wgsl/collections/compose-chunks-wgsl.js';

/**
 * @import { Texture } from '../../platform/graphics/texture.js';
 */

/**
 * Render pass implementation of the final post-processing composition.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassCompose extends RenderPassShaderQuad {
    /**
     * @type {Texture|null}
     */
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

    vignetteColor = new Color(0, 0, 0);

    _fringingEnabled = false;

    fringingIntensity = 10;

    _colorEnhanceEnabled = false;

    colorEnhanceShadows = 0;

    colorEnhanceHighlights = 0;

    colorEnhanceVibrance = 0;

    colorEnhanceDehaze = 0;

    colorEnhanceMidtones = 0;

    _taaEnabled = false;

    _sharpness = 0.5;

    _gammaCorrection = GAMMA_SRGB;

    /**
     * @type {Texture|null}
     */
    _colorLUT = null;

    colorLUTIntensity = 1;

    _key = '';

    _debug = null;

    // track user-provided custom compose chunks
    _customComposeChunks = new Map([
        ['composeDeclarationsPS', ''],
        ['composeMainStartPS', ''],
        ['composeMainEndPS', '']
    ]);

    constructor(graphicsDevice) {
        super(graphicsDevice);

        // register compose shader chunks
        ShaderChunks.get(graphicsDevice, SHADERLANGUAGE_GLSL).add(composeChunksGLSL, false);
        ShaderChunks.get(graphicsDevice, SHADERLANGUAGE_WGSL).add(composeChunksWGSL, false);

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
        this.vignetteColorId = scope.resolve('vignetteColor');
        this.fringingIntensityId = scope.resolve('fringingIntensity');
        this.sceneTextureInvResId = scope.resolve('sceneTextureInvRes');
        this.sceneTextureInvResValue = new Float32Array(2);
        this.sharpnessId = scope.resolve('sharpness');
        this.colorLUTId = scope.resolve('colorLUT');
        this.colorLUTParams = new Float32Array(4);
        this.colorLUTParamsId = scope.resolve('colorLUTParams');
        this.colorEnhanceParamsId = scope.resolve('colorEnhanceParams');
        this.colorEnhanceMidtonesId = scope.resolve('colorEnhanceMidtones');
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

    set colorLUT(value) {
        if (this._colorLUT !== value) {
            this._colorLUT = value;
            this._shaderDirty = true;
        }
    }

    get colorLUT() {
        return this._colorLUT;
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

    set colorEnhanceEnabled(value) {
        if (this._colorEnhanceEnabled !== value) {
            this._colorEnhanceEnabled = value;
            this._shaderDirty = true;
        }
    }

    get colorEnhanceEnabled() {
        return this._colorEnhanceEnabled;
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

        const shaderChunks = ShaderChunks.get(this.device, this.device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL);

        // detect changes to custom compose chunks and mark shader dirty
        for (const [name, prevValue] of this._customComposeChunks.entries()) {
            const currentValue = shaderChunks.get(name);
            if (currentValue !== prevValue) {
                this._customComposeChunks.set(name, currentValue);
                this._shaderDirty = true;
            }
        }

        // need to rebuild shader
        if (this._shaderDirty) {
            this._shaderDirty = false;

            const gammaCorrectionName = gammaNames[this._gammaCorrection];

            // include hashes of custom compose chunks to ensure unique program for overrides
            const customChunks = this._customComposeChunks;
            const declHash = hashCode(customChunks.get('composeDeclarationsPS') ?? '');
            const startHash = hashCode(customChunks.get('composeMainStartPS') ?? '');
            const endHash = hashCode(customChunks.get('composeMainEndPS') ?? '');

            const key =
                `${this.toneMapping}` +
                `-${gammaCorrectionName}` +
                `-${this.bloomTexture ? 'bloom' : 'nobloom'}` +
                `-${this.cocTexture ? 'dof' : 'nodof'}` +
                `-${this.blurTextureUpscale ? 'dofupscale' : ''}` +
                `-${this.ssaoTexture ? 'ssao' : 'nossao'}` +
                `-${this.gradingEnabled ? 'grading' : 'nograding'}` +
                `-${this.colorEnhanceEnabled ? 'colorenhance' : 'nocolorenhance'}` +
                `-${this.colorLUT ? 'colorlut' : 'nocolorlut'}` +
                `-${this.vignetteEnabled ? 'vignette' : 'novignette'}` +
                `-${this.fringingEnabled ? 'fringing' : 'nofringing'}` +
                `-${this.taaEnabled ? 'taa' : 'notaa'}` +
                `-${this.isSharpnessEnabled ? 'cas' : 'nocas'}` +
                `-${this._debug ?? ''}` +
                `-decl${declHash}-start${startHash}-end${endHash}`;

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
                if (this.colorEnhanceEnabled) defines.set('COLOR_ENHANCE', true);
                if (this.colorLUT) defines.set('COLOR_LUT', true);
                if (this.vignetteEnabled) defines.set('VIGNETTE', true);
                if (this.fringingEnabled) defines.set('FRINGING', true);
                if (this.taaEnabled) defines.set('TAA', true);
                if (this.isSharpnessEnabled) defines.set('CAS', true);
                if (this._debug) defines.set('DEBUG_COMPOSE', this._debug);

                const includes = new Map(shaderChunks);

                this.shader = ShaderUtils.createShader(this.device, {
                    uniqueName: `ComposeShader-${key}`,
                    attributes: { aPosition: SEMANTIC_POSITION },
                    vertexChunk: 'quadVS',
                    fragmentChunk: 'composePS',
                    fragmentDefines: defines,
                    fragmentIncludes: includes
                });
            }
        }
    }

    execute() {

        const sceneTex = this.sceneTexture;
        this.sceneTextureId.setValue(sceneTex);
        this.sceneTextureInvResValue[0] = 1.0 / sceneTex.width;
        this.sceneTextureInvResValue[1] = 1.0 / sceneTex.height;
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

        if (this._colorEnhanceEnabled) {
            this.colorEnhanceParamsId.setValue([this.colorEnhanceShadows, this.colorEnhanceHighlights, this.colorEnhanceVibrance, this.colorEnhanceDehaze]);
            this.colorEnhanceMidtonesId.setValue(this.colorEnhanceMidtones);
        }

        const lutTexture = this._colorLUT;
        if (lutTexture) {
            this.colorLUTParams[0] = lutTexture.width;
            this.colorLUTParams[1] = lutTexture.height;
            this.colorLUTParams[2] = lutTexture.height - 1.0;
            this.colorLUTParams[3] = this.colorLUTIntensity;
            this.colorLUTParamsId.setValue(this.colorLUTParams);
            this.colorLUTId.setValue(lutTexture);
        }

        if (this._vignetteEnabled) {
            this.vignetterParamsId.setValue([this.vignetteInner, this.vignetteOuter, this.vignetteCurvature, this.vignetteIntensity]);
            this.vignetteColorId.setValue([this.vignetteColor.r, this.vignetteColor.g, this.vignetteColor.b]);
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
