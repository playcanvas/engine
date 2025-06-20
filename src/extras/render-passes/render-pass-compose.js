import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
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

    /**
     * @type {Texture|null}
     */
    _colorLUT = null;

    colorLUTIntensity = 1;

    _key = '';

    _debug = null;

    constructor(graphicsDevice) {
        super(graphicsDevice);

        // register compose shader chunks
        ShaderChunks.get(graphicsDevice, SHADERLANGUAGE_GLSL).add(composeChunksGLSL);
        ShaderChunks.get(graphicsDevice, SHADERLANGUAGE_WGSL).add(composeChunksWGSL);

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
        this.colorLUTId = scope.resolve('colorLUT');
        this.colorLUTParams = new Float32Array(4);
        this.colorLUTParamsId = scope.resolve('colorLUTParams');
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
                `-${this.colorLUT ? 'colorlut' : 'nocolorlut'}` +
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
                if (this.colorLUT) defines.set('COLOR_LUT', true);
                if (this.vignetteEnabled) defines.set('VIGNETTE', true);
                if (this.fringingEnabled) defines.set('FRINGING', true);
                if (this.taaEnabled) defines.set('TAA', true);
                if (this.isSharpnessEnabled) defines.set('CAS', true);
                if (this._debug) defines.set('DEBUG_COMPOSE', this._debug);

                const includes = new Map(ShaderChunks.get(this.device, this.device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL));

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
