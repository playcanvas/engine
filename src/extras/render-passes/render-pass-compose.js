import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Debug } from '../../core/debug.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { hashCode } from '../../core/hash.js';
import { FILTER_LINEAR, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import { composeChunksGLSL } from '../../scene/shader-lib/glsl/collections/compose-chunks-glsl.js';
import { composeChunksWGSL } from '../../scene/shader-lib/wgsl/collections/compose-chunks-wgsl.js';
import { composeSlots } from './constants.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js';
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
 * @import { Texture } from '../../platform/graphics/texture.js';
 * @import { CameraFrameEffect } from './camera-frame-effect.js';
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

    _shaderDirty = true;

    _fringingEnabled = false;

    fringingIntensity = 10;

    _colorEnhanceEnabled = false;

    colorEnhanceShadows = 0;

    colorEnhanceHighlights = 0;

    colorEnhanceVibrance = 0;

    colorEnhanceDehaze = 0;

    colorEnhanceMidtones = 0;

    _taaEnabled = false;

    _hdrScene = true;

    _sharpness = 0.5;

    _gammaCorrection = GAMMA_SRGB;

    /**
     * @type {Texture|null}
     */
    _colorLUT = null;

    /**
     * @type {Texture|null}
     */
    _colorLUT2 = null;

    colorLUTIntensity = 1;

    colorLUT2Intensity = 1;

    colorLUTBlend = 0;

    _key = '';

    _debug = null;

    _sceneDepthAvailable = false;

    // track user-provided custom compose chunks
    _customComposeChunks = new Map([
        ['composeDeclarationsPS', ''],
        ['composeMainStartPS', ''],
        ['composeMainEndPS', '']
    ]);

    /**
     * The effects contributing to the composition, in the order they are applied within their
     * slot.
     *
     * @type {CameraFrameEffect[]}
     * @private
     */
    _effects = [];

    /**
     * The per-frame state of the effects the shader was last built for - which are active, and
     * the version of their defines. Tracked outside the shader rebuild so that an effect becoming
     * active or changing a define is detected without the effect needing property setters.
     *
     * @private
     */
    _effectsState = '';

    /**
     * @param {GraphicsDevice} graphicsDevice - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera this composes the frame of. Only the depth
     * debug mode needs it, for the depth encoding the camera renders and its clip range.
     */
    constructor(graphicsDevice, cameraComponent) {
        super(graphicsDevice);

        this.cameraComponent = cameraComponent;

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
        this.fringingIntensityId = scope.resolve('fringingIntensity');
        this.sceneTextureInvResId = scope.resolve('sceneTextureInvRes');
        this.sceneTextureInvResValue = new Float32Array(2);
        this.sharpnessId = scope.resolve('sharpness');
        this.colorLUTId = scope.resolve('colorLUT');
        this.colorLUT2Id = scope.resolve('colorLUT2');
        this.colorLUTParams = new Float32Array(3);
        this.colorLUTParamsId = scope.resolve('colorLUTParams');
        this.colorEnhanceParamsId = scope.resolve('colorEnhanceParams');
        this.colorEnhanceMidtonesId = scope.resolve('colorEnhanceMidtones');
        this.composeTargetFlipYId = scope.resolve('composeTargetFlipY');
        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');
    }

    /**
     * Sets the effects contributing to the composition. Their chunks are registered with the
     * device's shader chunks without overwriting chunks already provided, so each remains
     * overridable by name.
     *
     * @type {CameraFrameEffect[]}
     */
    set effects(value) {
        this._effects = value ?? [];
        this._registerEffectChunks();
        this._shaderDirty = true;
    }

    get effects() {
        return this._effects;
    }

    /**
     * Registers the chunks of all effects, and starts tracking them for user overrides alongside
     * the custom compose chunks.
     *
     * @private
     */
    _registerEffectChunks() {

        const activeLanguage = this.device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;

        // chunks are registered by name into the device-wide chunk map, and resolved through it so
        // that a user override wins. The flip side is that two effects supplying the same chunk
        // name both resolve to whichever registered first, silently - the second effect's shader
        // is never used. Catch that among the effects of this composition.
        Debug.call(() => {
            const owners = new Map();
            for (const effect of this._effects) {
                if (effect.getChunk(activeLanguage)) {
                    const name = effect.chunkName;
                    const owner = owners.get(name);
                    if (owner && owner !== effect) {
                        Debug.warnOnce(`RenderPassCompose: effects '${owner.id}' and '${effect.id}' both supply the shader chunk '${name}'. ` +
                            `Chunk names are shared by all effects, and '${effect.id}' resolves to the chunk of '${owner.id}' - ` +
                            'give the chunk a unique name, or leave the name to be derived from a unique effect id.');
                    } else {
                        owners.set(name, effect);
                    }
                }
            }
        });

        for (const shaderLanguage of [SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL]) {
            const shaderChunks = ShaderChunks.get(this.device, shaderLanguage);
            for (const effect of this._effects) {
                const source = effect.getChunk(shaderLanguage);
                if (source) {
                    const name = effect.chunkName;
                    shaderChunks.add({ [name]: source }, false);

                    // track for override detection, seeded with the resolved value so that
                    // registering does not by itself count as a change
                    if (shaderLanguage === activeLanguage) {
                        this._customComposeChunks.set(name, shaderChunks.get(name));
                    }
                }
            }
        }
    }

    /**
     * Collects the contributions of the active effects: the declarations of their chunks, assembled
     * into one include, and the defines driving the static slot and debug chunks of the composition
     * - a call count per slot with the entry function names injected into the slot's call chunk,
     * and the debug function of the effect providing the active debug view.
     *
     * @param {string} shaderLanguage - The shader language.
     * @param {Map<string, *>} defines - The defines the effects add to.
     * @returns {Map<string, string>} The assembled includes.
     * @private
     */
    _buildEffectChunks(shaderLanguage, defines) {

        const shaderChunks = ShaderChunks.get(this.device, shaderLanguage);
        const declarations = [];
        const counts = new Map();
        const debugMode = this._debugMode;

        for (const effect of this._effects) {
            if (!effect.active) continue;

            // the define marking the effect active, for chunks which test for it, and any the
            // effect set itself
            defines.set(effect.defineName, true);
            effect._defines.forEach((value, name) => defines.set(name, value));

            // the chunk, resolved through the chunk map so that a user override of it wins
            const source = effect.getChunk(shaderLanguage);
            if (source) {
                declarations.push(shaderChunks.get(effect.chunkName) ?? source);
            }

            // the slot's call chunk is included once per effect, each call naming the entry
            // function through an injected define: `result = {COMPOSE_LDR_FN0}(result, uv);`
            const { slot } = effect;
            if (slot && source) {
                const index = counts.get(slot) ?? 0;
                defines.set(`{COMPOSE_${slot.toUpperCase()}_FN${index}}`, effect.entryPoint);
                counts.set(slot, index + 1);
            }

            // the debug view, when this effect provides the active one
            if (debugMode && effect.debugViews.includes(debugMode)) {
                defines.set('COMPOSE_EFFECT_DEBUG', true);
                defines.set('{COMPOSE_DEBUG_FN}', `debug${debugMode.charAt(0).toUpperCase()}${debugMode.slice(1)}`);
            }
        }

        // every slot needs its count, zero included, for its include to resolve
        for (const slot of composeSlots) {
            defines.set(`COMPOSE_${slot.toUpperCase()}_COUNT`, String(counts.get(slot) ?? 0));
        }

        return new Map([['composeEffectDeclarationsPS', declarations.join('\n')]]);
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

    /**
     * Whether the scene depth this frame renders is available to sample, which the depth debug mode
     * displays instead of producing a depth of its own - a debug mode never changes what is rendered.
     *
     * @type {boolean}
     */
    set sceneDepthAvailable(value) {
        if (this._sceneDepthAvailable !== value) {
            this._sceneDepthAvailable = value;
            this._shaderDirty = true;
        }
    }

    get sceneDepthAvailable() {
        return this._sceneDepthAvailable;
    }

    /**
     * The debug mode the shader is built for. This is the requested mode, except that a request for the
     * depth with no depth to sample renders black instead.
     *
     * @type {string|null}
     * @private
     */
    get _debugMode() {
        if (this._debug === 'depth' && !this._sceneDepthAvailable) {
            return 'depthmissing';
        }
        return this._debug;
    }

    set colorLUT(value) {
        if (this._colorLUT !== value) {
            this._colorLUT = value;
            this._shaderDirty = true;
            this._validateColorLUT(value, 'colorLUT');
        }
    }

    get colorLUT() {
        return this._colorLUT;
    }

    set colorLUT2(value) {
        if (this._colorLUT2 !== value) {
            this._colorLUT2 = value;
            this._shaderDirty = true;
            this._validateColorLUT(value, 'colorLUT2');
        }
    }

    get colorLUT2() {
        return this._colorLUT2;
    }

    // Validate that a LUT texture is configured as a 256x16 sRGB strip with no mipmaps and
    // linear filtering. Stripped in release builds.
    _validateColorLUT(value, slotName) {
        Debug.call(() => {
            if (value) {
                const required = [];
                if (value.width !== 256 || value.height !== 16) required.push('size: 256x16');
                if (!value.srgb) required.push('srgb: true');
                if (value.mipmaps) required.push('mipmaps: false');
                if (value.minFilter !== FILTER_LINEAR) required.push('minFilter: FILTER_LINEAR');
                if (value.magFilter !== FILTER_LINEAR) required.push('magFilter: FILTER_LINEAR');
                if (required.length) {
                    Debug.warnOnce(`CameraFrame.${slotName}: texture '${value.name ?? ''}' should be configured with: ${required.join('; ')}.`, value);
                }
            }
        });
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

    set hdrScene(value) {
        if (this._hdrScene !== value) {
            this._hdrScene = value;
            this._shaderDirty = true;
        }
    }

    get hdrScene() {
        return this._hdrScene;
    }

    postInit() {
        // clear all buffers to avoid them being loaded from memory
        this.setClearColor(Color.BLACK);
        this.setClearDepth(1.0);
        this.setClearStencil(0);
    }

    frameUpdate() {

        // apply the automatic render target sizing configured by init()
        super.frameUpdate();

        // detect if the render target is srgb vs execute manual srgb conversion
        const rt = this.renderTarget ?? this.device.backBuffer;
        const srgb = rt.isColorBufferSrgb(0);
        const neededGammaCorrection = srgb ? GAMMA_NONE : GAMMA_SRGB;
        if (this._gammaCorrection !== neededGammaCorrection) {
            this._gammaCorrection = neededGammaCorrection;
            this._shaderDirty = true;
        }

        const shaderLanguage = this.device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        const shaderChunks = ShaderChunks.get(this.device, shaderLanguage);

        // detect changes to custom compose chunks and mark shader dirty
        for (const [name, prevValue] of this._customComposeChunks.entries()) {
            const currentValue = shaderChunks.get(name);
            if (currentValue !== prevValue) {
                this._customComposeChunks.set(name, currentValue);
                this._shaderDirty = true;
            }
        }

        // detect an effect becoming active, or changing its defines
        let effectsState = '';
        for (const effect of this._effects) {
            if (effect.active) {
                effectsState += `${effect.id}:${effect._definesVersion};`;
            }
        }
        if (this._effectsState !== effectsState) {
            this._effectsState = effectsState;
            this._shaderDirty = true;
        }

        // need to rebuild shader
        if (this._shaderDirty) {
            this._shaderDirty = false;

            const { key, defines, includes } = this.getShaderVariant(shaderLanguage);
            if (this._key !== key) {
                this._key = key;

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

    /**
     * Returns the compose shader variant for the current state: the key identifying the program,
     * the fragment defines, and the fragment includes. Split out from {@link frameUpdate} so the
     * variant can be inspected without a shader being created, which the compose shader snapshot
     * test relies on.
     *
     * @param {string} shaderLanguage - The shader language the variant is built for, SHADERLANGUAGE_GLSL
     * or SHADERLANGUAGE_WGSL.
     * @returns {{ key: string, defines: Map<string, string>, includes: Map<string, string>|undefined }}
     * The variant.
     * @ignore
     */
    getShaderVariant(shaderLanguage) {

        const gammaCorrectionName = gammaNames[this._gammaCorrection];

        // include hashes of custom compose chunks to ensure unique program for overrides
        const customChunks = this._customComposeChunks;
        const declHash = hashCode(customChunks.get('composeDeclarationsPS') ?? '');
        const startHash = hashCode(customChunks.get('composeMainStartPS') ?? '');
        const endHash = hashCode(customChunks.get('composeMainEndPS') ?? '');

        // the depth debug mode samples the scene depth, whose encoding varies with what produced it
        const debugMode = this._debugMode;
        const depthDefines = new Map();
        const depthKey = debugMode === 'depth' ?
            ShaderUtils.addScreenDepthChunkDefines(this.cameraComponent.shaderParams, depthDefines) : '';

        const key =
            `${this.toneMapping}` +
            `-${gammaCorrectionName}` +
            `-${this.bloomTexture ? 'bloom' : 'nobloom'}` +
            `-${this.cocTexture ? 'dof' : 'nodof'}` +
            `-${this.blurTextureUpscale ? 'dofupscale' : ''}` +
            `-${this.ssaoTexture ? 'ssao' : 'nossao'}` +
            `-${this.colorEnhanceEnabled ? 'colorenhance' : 'nocolorenhance'}` +
            `-${this.colorLUT ? 'colorlut' : 'nocolorlut'}` +
            `-${this.colorLUT2 ? 'colorlut2' : 'nocolorlut2'}` +
            `-${this.fringingEnabled ? 'fringing' : 'nofringing'}` +
            `-${this.taaEnabled ? 'taa' : 'notaa'}` +
            `-${this.isSharpnessEnabled ? (this._hdrScene ? 'cashdr' : 'cas') : 'nocas'}` +
            `-${debugMode ?? ''}${depthKey}` +
            `-decl${declHash}-start${startHash}-end${endHash}`;

        const defines = new Map();
        defines.set('TONEMAP', tonemapNames[this.toneMapping]);
        defines.set('GAMMA', gammaCorrectionName);
        if (this.bloomTexture) defines.set('BLOOM', true);
        if (this.cocTexture) defines.set('DOF', true);
        if (this.blurTextureUpscale) defines.set('DOF_UPSCALE', true);
        if (this.ssaoTexture) defines.set('SSAO', true);
        if (this.colorEnhanceEnabled) defines.set('COLOR_ENHANCE', true);
        if (this.colorLUT) defines.set('COLOR_LUT', true);
        if (this.colorLUT && this.colorLUT2) defines.set('COLOR_LUT2', true);
        if (this.fringingEnabled) defines.set('FRINGING', true);
        if (this.taaEnabled) defines.set('TAA', true);
        if (this.isSharpnessEnabled) {
            defines.set('CAS', true);
            if (this._hdrScene) defines.set('CAS_HDR', true);
        }
        if (debugMode) defines.set('DEBUG_COMPOSE', debugMode);
        depthDefines.forEach((value, name) => defines.set(name, value));

        // the effects: the active ids stay readable in the shader name, while their defines and
        // assembled chunks are hashed - an override of an effect's chunk changes the program
        // without changing any other state, so the chunk content has to be part of the key
        const effectDefines = new Map();
        const includes = this._buildEffectChunks(shaderLanguage, effectDefines);
        let effectIds = '';
        let effectsHash = 0;
        for (const effect of this._effects) {
            if (effect.active) {
                effectIds += `${effectIds ? ',' : ''}${effect.id}`;
            }
        }
        effectDefines.forEach((value, name) => {
            defines.set(name, value);
            effectsHash = hashCode(`${effectsHash}-${name}=${value}`);
        });
        includes.forEach((value) => {
            effectsHash = hashCode(`${effectsHash}-${value}`);
        });

        return { key: `${key}-fx:${effectIds}-${effectsHash}`, defines, includes };
    }

    execute() {

        // the clip range the depth debug mode maps to its ramp, and what the depth chunk linearizes
        // with. Only set for that mode, so the rest of the composition leaves the camera state alone.
        if (this._debugMode === 'depth') {
            this.cameraParamsId.setValue(this.cameraComponent.camera.fillShaderParams(this.cameraParams));
        }

        const sceneTex = this.sceneTexture;
        this.sceneTextureId.setValue(sceneTex);
        this.sceneTextureInvResValue[0] = 1.0 / sceneTex.width;
        this.sceneTextureInvResValue[1] = 1.0 / sceneTex.height;
        this.sceneTextureInvResId.setValue(this.sceneTextureInvResValue);

        // the scene chain renders with the API-native orientation - when the target render
        // target stores a flipped image, flip the sampling vertically so the composed result
        // lands in the requested row order
        this.composeTargetFlipYId.setValue(this.renderTarget?.flipY ? 1 : 0);

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

        if (this._colorEnhanceEnabled) {
            this.colorEnhanceParamsId.setValue([this.colorEnhanceShadows, this.colorEnhanceHighlights, this.colorEnhanceVibrance, this.colorEnhanceDehaze]);
            this.colorEnhanceMidtonesId.setValue(this.colorEnhanceMidtones);
        }

        const lutTexture = this._colorLUT;
        if (lutTexture) {
            this.colorLUTParams[0] = this.colorLUTIntensity;
            this.colorLUTParams[1] = this.colorLUT2Intensity;
            this.colorLUTParams[2] = this.colorLUTBlend;
            this.colorLUTParamsId.setValue(this.colorLUTParams);
            this.colorLUTId.setValue(lutTexture);

            if (this._colorLUT2) {
                this.colorLUT2Id.setValue(this._colorLUT2);
            }
        }

        if (this._fringingEnabled) {
            // relative to a fixed texture resolution to preserve size regardless of the resolution
            this.fringingIntensityId.setValue(this.fringingIntensity / 1024);
        }

        if (this.isSharpnessEnabled) {
            this.sharpnessId.setValue(math.lerp(-0.125, -0.2, this.sharpness));
        }

        // the effects write their uniforms right before the draw, not while the frame is prepared:
        // every camera is prepared before any of them renders, and the uniforms are shared, so a
        // value written earlier would be the last camera's
        const effects = this._effects;
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            if (effect.active) {
                effect.update();
            }
        }

        super.execute();
    }
}

export { RenderPassCompose };
