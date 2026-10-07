import { Debug } from '../../core/debug.js';
import { SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';

/**
 * @import { CameraFrame } from './camera-frame.js'
 * @import { FramePass } from '../../platform/graphics/frame-pass.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ScopeId } from '../../platform/graphics/scope-id.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js'
 */

/**
 * The context handed to {@link CameraFrameEffect#frameUpdate} by the camera frame the effect is
 * registered with: the values of the frame being prepared. Valid only for the duration of that
 * call - the object is reused, and its contents change from frame to frame.
 *
 * The texture is this frame's, but its size is final only once the frame's passes are updated,
 * after that call - when the canvas or the render target scale changes, it still has the size of
 * the previous frame. Use the sizes in the context instead of the texture's own.
 *
 * @typedef {object} CameraFrameEffectContext
 * @property {Texture} sceneTexture - The scene color the composition reads this frame: the output
 * of the temporal anti-aliasing when it is enabled, which alternates between two textures from
 * frame to frame, and the scene render target's color otherwise.
 * @property {number} sceneWidth - The width of the scene texture this frame, in pixels.
 * @property {number} sceneHeight - The height of the scene texture this frame, in pixels.
 */

// capitalizes the first character of a name, to derive the identifiers an effect's chunk uses
const capitalize = name => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * Base class of an effect registered with a {@link CameraFrame}. An effect is constructed with the
 * graphics device, its id and its declarations - the compose slot it applies at and its shader
 * chunk - and exposes its parameters as fields. Declarations are fixed for the life of the effect;
 * anything that depends on a parameter is a getter instead, like {@link CameraFrameEffect#active}.
 *
 * An effect contributes to the composition: you supply its shader chunk (GLSL and WGSL) and write
 * its entry function under a conventional name, `apply<Id>`. The camera frame generates the call to
 * that function at the effect's slot, and rebuilds the compose shader when an effect becomes active
 * or inactive, or changes one of its defines. The chunk is only included while the effect is
 * active, so it needs no `#ifdef` guard of its own - defines are for an effect's own variants, set
 * with {@link CameraFrameEffect#setDefine}. The chunk can be overridden by name like the built-in
 * chunks: a chunk set in {@link ShaderChunks} under `compose<Id>PS` replaces the effect's own
 * source. `<ID>` (the id in upper snake case) is defined while the effect is active, should
 * another chunk need to know. Each debug view `name` the effect lists is backed the same way as
 * the entry function, by a `debug<Name>()` function in the chunk.
 *
 * All effects registered to a compose slot are called in registration order from within the single
 * compose pass, so an effect never costs an additional full-screen pass.
 *
 * Every chunk can read what the composition provides: the scene color, `sceneTexture`, and
 * `sceneTextureSize` - the width, height, 1 / width and 1 / height of the scene texture. Use the
 * size for anything which depends on the resolution, such as texel offsets, pixel sizes or the
 * aspect ratio, as it is always current for the camera being drawn.
 *
 * Like the rest of the camera frame, an effect is configured when {@link CameraFrame#update} is
 * called: changes to its parameters take effect at the next update, and every frame rendered after
 * it uses exactly what the update applied.
 *
 * Lifetime:
 *
 * - **Construct** - pass the device, the id and the declarations to the constructor; declare the
 *   parameters as fields. Resources the effect keeps for its whole life - a lookup texture, a noise
 *   texture - are created here, and fixed defines can be set with
 *   {@link CameraFrameEffect#setDefine}.
 * - **On {@link CameraFrame#update}, while {@link CameraFrameEffect#active}** -
 *   {@link CameraFrameEffect#update} applies the parameters: the values of the uniforms with
 *   {@link CameraFrameEffect#setUniform}, and the defines that depend on them.
 * - **Each frame while it takes part** - {@link CameraFrameEffect#frameUpdate} is called with the
 *   values of the frame being prepared, for the few effects which depend on them. Most effects do
 *   not need it.
 * - **Destroy** - {@link CameraFrameEffect#destroy} releases what the constructor created. Whoever
 *   constructs an effect destroys it: the camera frame destroys its built-in effects, and an effect
 *   you add is yours to destroy.
 *
 * @example
 * // A tint applied in display space, after tone mapping. The chunk declares its uniform and the
 * // entry function applyTint, which the composition calls as `result = applyTint(result, uv)`.
 * class TintEffect extends CameraFrameEffect {
 *     color = new Color(1, 0.9, 0.8);
 *
 *     tintColor = new Float32Array(3);
 *
 *     constructor(device) {
 *         super(device, 'tint', {
 *             slot: COMPOSESLOT_LDR,
 *             glsl: `
 *                 uniform vec3 tintColor;
 *                 vec3 applyTint(vec3 color, vec2 uv) {
 *                     return color * tintColor;
 *                 }
 *             `,
 *             wgsl: `
 *                 uniform tintColor: vec3f;
 *                 fn applyTint(color: vec3f, uv: vec2f) -> vec3f {
 *                     return color * uniform.tintColor;
 *                 }
 *             `
 *         });
 *     }
 *
 *     update() {
 *         this.tintColor[0] = this.color.r;
 *         this.tintColor[1] = this.color.g;
 *         this.tintColor[2] = this.color.b;
 *         this.setUniform('tintColor', this.tintColor);
 *     }
 * }
 *
 * cameraFrame.addEffect(new TintEffect(app.graphicsDevice));
 *
 * // The same effect without a class, for effects driven by data
 * const tint = new CameraFrameEffect(app.graphicsDevice, 'tint', { slot: COMPOSESLOT_LDR, glsl, wgsl });
 * tint.setUniform('tintColor', new Float32Array([1, 0.9, 0.8]));
 * cameraFrame.addEffect(tint);
 * @category Graphics
 */
class CameraFrameEffect {
    /**
     * The graphics device.
     *
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Whether the effect is enabled. An effect can additionally disable itself from its own
     * parameters, see {@link CameraFrameEffect#active}.
     *
     * @type {boolean}
     */
    enabled = true;

    /**
     * The camera frame the effect is registered with, or null.
     *
     * @type {CameraFrame|null}
     */
    cameraFrame = null;

    /**
     * The frame resources provisioned for the effect's passes. Valid from
     * {@link CameraFrameEffect#createPasses} until {@link CameraFrameEffect#destroyPasses}, null
     * otherwise.
     *
     * @type {object|null}
     * @ignore
     */
    resources = null;

    /** @private */
    _id;

    /** @private */
    _slot;

    /** @private */
    _glsl;

    /** @private */
    _wgsl;

    /** @private */
    _debugViews;

    /** @private */
    _chunkName;

    /** @private */
    _entryPoint;

    /** @private */
    _requires;

    /** @private */
    _stage;

    /**
     * The compose defines the effect has set, see {@link CameraFrameEffect#setDefine}.
     *
     * @type {Map<string, *>}
     * @ignore
     */
    _defines = new Map();

    /**
     * Incremented when the defines change, so the composition can detect it cheaply.
     *
     * @type {number}
     * @ignore
     */
    _definesVersion = 0;

    /**
     * The uniform values set with {@link CameraFrameEffect#setUniform}, bound right before the
     * compose pass renders.
     *
     * @type {Map<string, { scopeId: ScopeId, value: * }>}
     * @private
     */
    _uniforms = new Map();

    /**
     * Creates a new effect.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} id - The identifier of the effect, unique among the effects of a camera frame.
     * The names of the chunk, its entry function and its define are derived from it.
     * @param {object} [options] - The declarations of the effect. All are optional.
     * @param {string} [options.slot] - The compose slot the entry function is called at, one of the
     * COMPOSESLOT_* constants. Omit for an effect that does not take part in the composition, for
     * example one that only owns passes.
     * @param {string} [options.glsl] - The GLSL source of the compose chunk.
     * @param {string} [options.wgsl] - The WGSL source of the compose chunk.
     * @param {string[]} [options.debugViews] - The names of the debug views the chunk provides. Each
     * view `name` requires the chunk to declare a `vec3 debug<Name>()` function, and is available
     * while the effect is active.
     * @param {string} [options.chunkName] - The name the compose chunk can be overridden under, when
     * it should differ from the derived `compose<Id>PS`.
     * @param {string} [options.entryPoint] - The name of the function the composition calls, when it
     * should differ from the derived `apply<Id>`.
     */
    constructor(device, id, options = {}) {
        Debug.assert(device, 'CameraFrameEffect: a graphics device is required.');
        Debug.assert(typeof id === 'string' && id.length > 0, 'CameraFrameEffect: an id is required.');
        this.device = device;
        this._id = id;
        this._slot = options.slot ?? null;
        this._glsl = options.glsl ?? null;
        this._wgsl = options.wgsl ?? null;
        this._debugViews = options.debugViews ?? [];
        this._chunkName = options.chunkName ?? null;
        this._entryPoint = options.entryPoint ?? null;

        // the declarations of an effect owning passes - the frame resources they need and the
        // stage they run at - are accepted but not documented until pass ownership is complete
        const passOptions = /** @type {{ requires?: string[], stage?: string }} */ (
            /** @type {object} */ (options)
        );
        this._requires = passOptions.requires ?? [];
        this._stage = passOptions.stage ?? null;
    }

    /**
     * Gets the identifier of the effect.
     *
     * @type {string}
     */
    get id() {
        return this._id;
    }

    /**
     * Gets the compose slot the entry function is called at, or null for an effect that does not
     * take part in the composition.
     *
     * @type {string|null}
     */
    get slot() {
        return this._slot;
    }

    /**
     * Gets the GLSL source of the compose chunk, or null when the effect has none.
     *
     * @type {string|null}
     */
    get glsl() {
        return this._glsl;
    }

    /**
     * Gets the WGSL source of the compose chunk, or null when the effect has none.
     *
     * @type {string|null}
     */
    get wgsl() {
        return this._wgsl;
    }

    /**
     * Gets the names of the debug views the chunk provides.
     *
     * @type {string[]}
     */
    get debugViews() {
        return this._debugViews;
    }

    /**
     * Gets the name the compose chunk can be overridden under in {@link ShaderChunks}, the same
     * way as the built-in chunks. Derived from the id as `compose<Id>PS` unless given.
     *
     * @type {string}
     */
    get chunkName() {
        return this._chunkName ?? `compose${capitalize(this.id)}PS`;
    }

    /**
     * Gets the name of the function the composition calls at the effect's slot. Derived from the
     * id as `apply<Id>` unless given. The signature depends on the slot: colour slots take
     * `(vec3 color, vec2 uv)` and return the colour, {@link COMPOSESLOT_SCENE} takes and returns a
     * `vec4`.
     *
     * @type {string}
     */
    get entryPoint() {
        return this._entryPoint ?? `apply${capitalize(this.id)}`;
    }

    /**
     * Gets the define set on the compose shader while the effect is active: the id in upper snake
     * case, `colorEnhance` giving `COLOR_ENHANCE`.
     *
     * @type {string}
     */
    get defineName() {
        return this.id.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
    }

    /**
     * Gets the frame resources the effect's passes need. Override as a getter when the requirement
     * depends on a parameter.
     *
     * @type {string[]}
     * @ignore
     */
    get requires() {
        return this._requires;
    }

    /**
     * Gets the stage the effect's passes run at, or null when it owns none. Override as a getter
     * when the stage depends on a parameter.
     *
     * @type {string|null}
     * @ignore
     */
    get stage() {
        return this._stage;
    }

    /**
     * Gets whether the effect contributes to the frame. Defaults to {@link CameraFrameEffect#enabled}.
     * Effects gated on a parameter - a zero intensity, a missing texture - override this.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled;
    }

    /**
     * Returns the compose chunk source for a shader language.
     *
     * @param {string} shaderLanguage - SHADERLANGUAGE_GLSL or SHADERLANGUAGE_WGSL.
     * @returns {string|null} The source, or null when the effect has no chunk.
     */
    getChunk(shaderLanguage) {
        return shaderLanguage === SHADERLANGUAGE_WGSL ? this._wgsl : this._glsl;
    }

    /**
     * Sets a define on the compose shader. The define persists until changed, so fixed defines
     * can be set once in the constructor and those depending on the parameters from
     * {@link CameraFrameEffect#update}. A value of false, null or undefined removes it. Changing a
     * define rebuilds the compose shader.
     *
     * @param {string} name - The define name.
     * @param {*} value - The value.
     */
    setDefine(name, value) {
        const defines = this._defines;
        if (value === false || value === null || value === undefined) {
            if (defines.delete(name)) {
                this._definesVersion++;
            }
        } else if (defines.get(name) !== value) {
            defines.set(name, value);
            this._definesVersion++;
        }
    }

    /**
     * Creates the passes the effect owns, when it has any. Called when the frame graph is built.
     *
     * @param {object} resources - The provisioned frame resources.
     * @returns {FramePass[]} The passes, in execution order.
     * @ignore
     */
    createPasses(resources) {
        return [];
    }

    /**
     * Destroys the passes and any resources {@link CameraFrameEffect#createPasses} created. Called
     * when the frame graph is torn down.
     *
     * @ignore
     */
    destroyPasses() {
    }

    /**
     * Returns a string which changes whenever the effect's passes need recreating - the parameters
     * which alter the pass graph rather than just its uniforms. Effects without passes do not
     * implement this.
     *
     * @returns {string} The key.
     * @ignore
     */
    buildKey() {
        return '';
    }

    /**
     * Sets the value of a uniform the effect's shader chunk reads. Like a material parameter, the
     * value is stored by reference, so an array or a texture can be updated in place. Set the
     * values in {@link CameraFrameEffect#update}, or in {@link CameraFrameEffect#frameUpdate} for
     * a value which changes every frame.
     *
     * @param {string} name - The name of the uniform, as declared in the chunk.
     * @param {number|number[]|ArrayBufferView|Texture} value - The value.
     */
    setUniform(name, value) {
        let uniform = this._uniforms.get(name);
        if (!uniform) {
            uniform = { scopeId: this.device.scope.resolve(name), value: null };
            this._uniforms.set(name, uniform);
        }
        uniform.value = value;
    }

    /**
     * Binds the uniform values, right before the compose pass renders.
     *
     * @ignore
     */
    _bindUniforms() {
        for (const uniform of this._uniforms.values()) {
            uniform.scopeId.setValue(uniform.value);
        }
    }

    /**
     * Applies the effect's parameters. Called by {@link CameraFrame#update} while the effect is
     * active, and when it is added to a camera frame: set the uniform values with
     * {@link CameraFrameEffect#setUniform} here, and the defines which depend on the parameters.
     * Everything it sets is what the frames rendered until the next update use.
     */
    update() {
    }

    /**
     * Called every frame while the effect takes part in the frame, while the frame is being
     * prepared and before any pass renders, with the values of that frame. Most effects do not
     * need it: their configuration belongs in {@link CameraFrameEffect#update}, which runs only
     * when the camera frame is updated. Values derived from the resolution, which can change
     * without an update, are computed here from the sizes in the frame, or in the shader from
     * `sceneTextureSize`.
     *
     * @param {CameraFrameEffectContext} frame - The values of this frame. Read them during this
     * call only.
     */
    frameUpdate(frame) {
    }

    /**
     * Destroys the effect, removing it from its camera frame if it is still registered and
     * releasing everything it owns. Subclasses which create resources in their constructor release
     * them in an override, calling `super.destroy()`.
     */
    destroy() {
        this.cameraFrame?.removeEffect(this);
        this.destroyPasses();
        this.device = null;
    }

    /**
     * @param {CameraFrame} cameraFrame - The camera frame the effect was added to.
     * @ignore
     */
    _attach(cameraFrame) {
        this.cameraFrame = cameraFrame;
    }

    /**
     * @ignore
     */
    _detach() {
        this.cameraFrame = null;
    }
}

export { CameraFrameEffect };
