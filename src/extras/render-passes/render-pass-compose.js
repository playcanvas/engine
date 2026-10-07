import { Color } from '../../core/math/color.js';
import { Debug } from '../../core/debug.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { GAMMA_NONE, GAMMA_SRGB, gammaNames, TONEMAP_LINEAR, tonemapNames } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { hashCode } from '../../core/hash.js';
import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
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

// the empty compose chunks users override to add their own code, always tracked for changes
const legacyComposeChunks = ['composeDeclarationsPS', 'composeMainStartPS', 'composeMainEndPS'];

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

    _taaEnabled = false;

    _gammaCorrection = GAMMA_SRGB;

    _key = '';

    _debug = null;

    _sceneDepthAvailable = false;

    // track user-provided custom compose chunks: the legacy hooks, and the override names of the
    // registered effects' chunks
    _customComposeChunks = new Map(legacyComposeChunks.map(name => [name, '']));

    /**
     * The effects taking part in the composition, in the order they are applied within their
     * slot - the active ones as of the last CameraFrame#update.
     *
     * @type {CameraFrameEffect[]}
     * @private
     */
    _effects = [];

    /**
     * The version of the defines of each of the effects the shader was last built for, so that a
     * define an update changed is detected without the effects needing property setters.
     *
     * @type {number[]}
     * @private
     */
    _effectVersions = [];

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
        this.sceneTextureSizeId = scope.resolve('sceneTextureSize');
        this.sceneTextureSizeValue = new Float32Array(4);
        this.composeTargetFlipYId = scope.resolve('composeTargetFlipY');
        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');
    }

    /**
     * Sets the effects taking part in the composition, all of which it composes. Each effect's
     * chunk can be overridden by its chunk name in the device's shader chunks; without an override
     * the effect's own source is used. Assigned on every CameraFrame#update - which can run every
     * frame - so assigning the same effects with unchanged defines costs only the comparison.
     *
     * @type {CameraFrameEffect[]}
     */
    set effects(value) {
        const effects = this._effects;
        const versions = this._effectVersions;
        let changed = effects.length !== value.length;
        for (let i = 0; !changed && i < value.length; i++) {
            changed = effects[i] !== value[i] || versions[i] !== value[i]._definesVersion;
        }

        if (changed) {
            effects.length = 0;
            versions.length = 0;
            for (let i = 0; i < value.length; i++) {
                effects.push(value[i]);
                versions.push(value[i]._definesVersion);
            }
            this._trackEffectChunks();
            this._shaderDirty = true;
        }
    }

    get effects() {
        return this._effects;
    }

    /**
     * Tracks the override names of the effects' chunks for changes, alongside the custom compose
     * chunks, so that setting or removing an override rebuilds the shader.
     *
     * An effect's own source is deliberately never put into the device's shader chunks: the map is
     * shared by everything on the device, so the first source registered under a name would stay
     * there, and a later effect with the same id - a replacement, a hot-reloaded script, the effect
     * of another camera - would silently render it instead of its own. An entry in the map under an
     * effect's chunk name is therefore always a user override.
     *
     * @private
     */
    _trackEffectChunks() {

        const shaderLanguage = this.device.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        const shaderChunks = ShaderChunks.get(this.device, shaderLanguage);

        // stop tracking the chunks of effects which are no longer registered
        const tracked = this._customComposeChunks;
        for (const name of tracked.keys()) {
            if (!legacyComposeChunks.includes(name)) {
                tracked.delete(name);
            }
        }

        // an override is looked up by chunk name, so one set for a name two effects share would
        // replace the shader of both. Catch that among the effects of this composition.
        Debug.call(() => {
            const owners = new Map();
            for (const effect of this._effects) {
                if (effect.getChunk(shaderLanguage)) {
                    const name = effect.chunkName;
                    const owner = owners.get(name);
                    if (owner && owner !== effect) {
                        Debug.warnOnce(`RenderPassCompose: effects '${owner.id}' and '${effect.id}' both use the shader chunk name '${name}'. ` +
                            'An override of that chunk would replace the shader of both - give the chunk a unique name, or leave the ' +
                            'name to be derived from a unique effect id.');
                    } else {
                        owners.set(name, effect);
                    }
                }
            }
        });

        // seeded with the current value, so that starting to track a name is not itself a change
        for (const effect of this._effects) {
            if (effect.getChunk(shaderLanguage)) {
                const name = effect.chunkName;
                tracked.set(name, shaderChunks.get(name));
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

            // the define marking the effect active, for chunks which test for it, and any the
            // effect set itself
            defines.set(effect.defineName, true);
            effect._defines.forEach((value, name) => defines.set(name, value));

            // the effect's chunk, unless the user overrode it by name in the chunk map
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

    set toneMapping(value) {
        if (this._toneMapping !== value) {
            this._toneMapping = value;
            this._shaderDirty = true;
        }
    }

    get toneMapping() {
        return this._toneMapping;
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
            `-${this.taaEnabled ? 'taa' : 'notaa'}` +
            `-${debugMode ?? ''}${depthKey}` +
            `-decl${declHash}-start${startHash}-end${endHash}`;

        const defines = new Map();
        defines.set('TONEMAP', tonemapNames[this.toneMapping]);
        defines.set('GAMMA', gammaCorrectionName);
        if (this.bloomTexture) defines.set('BLOOM', true);
        if (this.cocTexture) defines.set('DOF', true);
        if (this.blurTextureUpscale) defines.set('DOF_UPSCALE', true);
        if (this.ssaoTexture) defines.set('SSAO', true);
        if (this.taaEnabled) defines.set('TAA', true);
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
            effectIds += `${effectIds ? ',' : ''}${effect.id}`;
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
        const size = this.sceneTextureSizeValue;
        size[0] = sceneTex.width;
        size[1] = sceneTex.height;
        size[2] = 1.0 / sceneTex.width;
        size[3] = 1.0 / sceneTex.height;
        this.sceneTextureSizeId.setValue(size);

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

        // the uniform values of the effects are bound right before the draw, not when they are set:
        // every camera is prepared before any of them renders, and the uniforms are shared, so a
        // value bound earlier would be the last camera's
        const effects = this._effects;
        for (let i = 0; i < effects.length; i++) {
            effects[i]._bindUniforms();
        }

        super.execute();
    }
}

export { RenderPassCompose };
