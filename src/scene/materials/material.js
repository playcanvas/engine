import { Debug } from '../../core/debug.js';
import {
    BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR,
    BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDEQUATION_ADD, BLENDEQUATION_REVERSE_SUBTRACT,
    BLENDEQUATION_MIN, BLENDEQUATION_MAX,
    CULLFACE_BACK,
    SHADERLANGUAGE_GLSL
} from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import {
    BLEND_ADDITIVE, BLEND_NORMAL, BLEND_NONE, BLEND_PREMULTIPLIED,
    BLEND_MULTIPLICATIVE, BLEND_ADDITIVEALPHA, BLEND_MULTIPLICATIVE2X, BLEND_SCREEN,
    BLEND_MIN, BLEND_MAX, BLEND_SUBTRACTIVE
} from '../constants.js';
import { getDefaultMaterial } from './default-material.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

/**
 * @import { BindGroupFormat } from '../../platform/graphics/bind-group-format.js';
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Light } from '../light.js';
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { CameraShaderParams } from '../camera-shader-params.js'
 * @import { Scene } from '../scene.js'
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { StencilParameters } from '../../platform/graphics/stencil-parameters.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 * @import { UniformBufferFormat } from '../../platform/graphics/uniform-buffer-format.js';
 * @import { VertexFormat } from '../../platform/graphics/vertex-format.js';
 * @import { ShaderChunkMap } from '../shader-lib/shader-chunk-map.js';
 * @import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
 */

// blend mode mapping to op, srcBlend and dstBlend
const blendModes = [];
blendModes[BLEND_SUBTRACTIVE] = { src: BLENDMODE_ONE, dst: BLENDMODE_ONE, op: BLENDEQUATION_REVERSE_SUBTRACT };
blendModes[BLEND_NONE] = { src: BLENDMODE_ONE, dst: BLENDMODE_ZERO, op: BLENDEQUATION_ADD };
blendModes[BLEND_NORMAL] = { src: BLENDMODE_SRC_ALPHA, dst: BLENDMODE_ONE_MINUS_SRC_ALPHA, op: BLENDEQUATION_ADD, alphaSrc: BLENDMODE_ONE };
blendModes[BLEND_PREMULTIPLIED] = { src: BLENDMODE_ONE, dst: BLENDMODE_ONE_MINUS_SRC_ALPHA, op: BLENDEQUATION_ADD };
blendModes[BLEND_ADDITIVE] = { src: BLENDMODE_ONE, dst: BLENDMODE_ONE, op: BLENDEQUATION_ADD };
blendModes[BLEND_ADDITIVEALPHA] = { src: BLENDMODE_SRC_ALPHA, dst: BLENDMODE_ONE, op: BLENDEQUATION_ADD };
blendModes[BLEND_MULTIPLICATIVE2X] = { src: BLENDMODE_DST_COLOR, dst: BLENDMODE_SRC_COLOR, op: BLENDEQUATION_ADD };
blendModes[BLEND_SCREEN] = { src: BLENDMODE_ONE_MINUS_DST_COLOR, dst: BLENDMODE_ONE, op: BLENDEQUATION_ADD };
blendModes[BLEND_MULTIPLICATIVE] = { src: BLENDMODE_DST_COLOR, dst: BLENDMODE_ZERO, op: BLENDEQUATION_ADD };
blendModes[BLEND_MIN] = { src: BLENDMODE_ONE, dst: BLENDMODE_ONE, op: BLENDEQUATION_MIN };
blendModes[BLEND_MAX] = { src: BLENDMODE_ONE, dst: BLENDMODE_ONE, op: BLENDEQUATION_MAX };

let id = 0;

/**
 * @typedef {object} ShaderVariantParams - The description of the parameters used by the
 * Material#getShaderVariant function.
 * @property {GraphicsDevice} device - The graphics device.
 * @property {Scene} scene - The scene.
 * @property {number} objDefs - The object definitions.
 * @property {CameraShaderParams} cameraShaderParams - The camera shader parameters.
 * @property {number} pass - The shader pass.
 * @property {Light[][]} sortedLights - The sorted lights.
 * @property {UniformBufferFormat|undefined} viewUniformFormat - The view uniform format.
 * @property {BindGroupFormat|undefined} viewBindGroupFormat - The view bind group format.
 * @property {VertexFormat} vertexFormat - The vertex format.
 * @ignore
 */

/**
 * A material determines how a particular {@link MeshInstance} is rendered, and specifies
 * render state including uniforms, textures, defines, and other properties.
 *
 * This is a base class and cannot be instantiated and used directly. Only subclasses such
 * as {@link ShaderMaterial} and {@link StandardMaterial} can be used to define materials
 * for rendering.
 *
 * @category Graphics
 */
class Material {
    /**
     * The mesh instances referencing this material
     *
     * @type {MeshInstance[]}
     * @private
     */
    meshInstances = [];

    /**
     * The name of the material.
     *
     * @type {string}
     */
    name = 'Untitled';

    /**
     * A unique id the user can assign to the material. The engine internally does not use this for
     * anything, and the user can assign a value to this id for any purpose they like. Defaults to
     * an empty string.
     *
     * @type {string}
     */
    userId = '';

    id = id++;

    /**
     * The cache of shader variants generated for this material. The key represents the unique
     * variant, the value is the shader.
     *
     * @type {Map<number, Shader>}
     * @ignore
     */
    variants = new Map();

    /**
     * The set of defines used to generate the shader variants.
     *
     * @type {Map<string, string>}
     * @ignore
     */
    defines = new Map();

    _definesDirty = false;

    parameters = {};

    /**
     * The alpha test reference value to control which fragments are written to the currently
     * active render target based on alpha value. All fragments with an alpha value of less than
     * the alphaTest reference value will be discarded. alphaTest defaults to 0 (all fragments
     * pass).
     *
     * @type {number}
     */
    alphaTest = 0;

    /**
     * Enables or disables alpha to coverage (WebGL2 only). When enabled, and if hardware
     * anti-aliasing is on, limited order-independent transparency can be achieved. Quality depends
     * on the number of MSAA samples of the current render target. It can nicely soften edges of
     * otherwise sharp alpha cutouts, but isn't recommended for large area semi-transparent
     * surfaces. Note, that you don't need to enable blending to make alpha to coverage work. It
     * will work without it, just like alphaTest.
     *
     * @type {boolean}
     */
    alphaToCoverage = false;

    /** @ignore */
    _blendState = new BlendState();

    /** @ignore */
    _depthState = new DepthState();

    /**
     * Controls how triangles are culled based on their face direction with respect to the
     * viewpoint. Can be:
     *
     * - {@link CULLFACE_NONE}: Do not cull triangles based on face direction.
     * - {@link CULLFACE_BACK}: Cull the back faces of triangles (do not render triangles facing
     * away from the view point).
     * - {@link CULLFACE_FRONT}: Cull the front faces of triangles (do not render triangles facing
     * towards the view point).
     *
     * Defaults to {@link CULLFACE_BACK}.
     *
     * @type {number}
     */
    cull = CULLFACE_BACK;

    /**
     * Stencil parameters for front faces (default is null).
     *
     * @type {StencilParameters|null}
     */
    stencilFront = null;

    /**
     * Stencil parameters for back faces (default is null).
     *
     * @type {StencilParameters|null}
     */
    stencilBack = null;

    /**
     * @type {ShaderChunks|null}
     * @private
     */
    _shaderChunks = null;

    // this is deprecated, keeping for backwards compatibility
    _oldChunks = {};

    _dirtyShader = true;

    /** @protected */
    constructor() {
        if (new.target === Material) {
            Debug.error('Material class cannot be instantiated, use ShaderMaterial instead');
        }
    }

    /**
     * Returns true if the material has custom shader chunks.
     *
     * @type {boolean}
     * @ignore
     */
    get hasShaderChunks() {
        return this._shaderChunks != null;
    }

    /**
     * Returns the shader chunks for the material. Those get allocated if they are not already.
     *
     * @type {ShaderChunks}
     * @ignore
     */
    get shaderChunks() {
        if (!this._shaderChunks) {
            this._shaderChunks = new ShaderChunks();
        }
        return this._shaderChunks;
    }

    /**
     * Returns an object containing shader chunks for a specific shader language for the material.
     * These chunks define custom GLSL or WGSL code used to construct the final shader for the
     * material. The chunks can be also be included in shaders using the `#include "ChunkName"`
     * directive.
     *
     * On the WebGL platform:
     *  - If GLSL chunks are provided, they are used directly.
     *
     * On the WebGPU platform:
     * - If WGSL chunks are provided, they are used directly.
     * - If only GLSL chunks are provided, a GLSL shader is generated and then transpiled to WGSL,
     * which is less efficient.
     *
     * To ensure faster shader compilation, it is recommended to provide shader chunks for all
     * supported platforms.
     *
     * A simple example on how to override a shader chunk providing emissive color for both GLSL and
     * WGSL to simply return a red color:
     *
     * ```javascript
     * material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('emissivePS', `
     *     void getEmission() {
     *         dEmission = vec3(1.0, 0.0, 1.0);
     *     }
     * `);
     *
     * material.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set('emissivePS', `
     *     fn getEmission() {
     *         dEmission = vec3f(1.0, 0.0, 1.0);
     *     }
     * `);
     *
     * // call update to apply the changes
     * material.update();
     * ```
     *
     * @param {string} [shaderLanguage] - Specifies the shader language of shaders. Defaults to
     * {@link SHADERLANGUAGE_GLSL}.
     * @returns {ShaderChunkMap} - The shader chunks for the specified shader language.
     */
    getShaderChunks(shaderLanguage = SHADERLANGUAGE_GLSL) {
        const chunks = this.shaderChunks;
        return shaderLanguage === SHADERLANGUAGE_GLSL ? chunks.glsl : chunks.wgsl;
    }

    /**
     * Sets the version of the shader chunks.
     *
     * This should be a string containing the current engine major and minor version (e.g., '2.8'
     * for engine v2.8.1) and ensures compatibility with the current engine version. When providing
     * custom shader chunks, set this to the latest supported version. If a future engine release no
     * longer supports the specified version, a warning will be issued. In that case, update your
     * shader chunks to match the new format and set this to the latest version accordingly.
     *
     * @type {string}
     */
    set shaderChunksVersion(value) {
        this.shaderChunks.version = value;
    }

    /**
     * Returns the version of the shader chunks.
     *
     * @type {string}
     */
    get shaderChunksVersion() {
        return this.shaderChunks.version;
    }

    set chunks(value) {
        Debug.deprecated('Material.chunks has been removed, please use Material.getShaderChunks instead. For example: material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("chunkName", "chunkCode")');
        this._oldChunks = value;
    }

    get chunks() {
        Debug.deprecated('Material.chunks has been removed, please use Material.getShaderChunks instead. For example: material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("chunkName", "chunkCode")');
        Object.assign(this._oldChunks, Object.fromEntries(this.shaderChunks.glsl));
        return this._oldChunks;
    }

    /**
     * Sets the offset for the output depth buffer value. Useful for decals to prevent z-fighting.
     * Typically a small negative value (-0.1) is used to render the mesh slightly closer to the
     * camera.
     *
     * @type {number}
     */
    set depthBias(value) {
        this._depthState.depthBias = value;
    }

    /**
     * Gets the offset for the output depth buffer value.
     *
     * @type {number}
     */
    get depthBias() {
        return this._depthState.depthBias;
    }

    /**
     * Sets the offset for the output depth buffer value based on the slope of the triangle
     * relative to the camera.
     *
     * @type {number}
     */
    set slopeDepthBias(value) {
        this._depthState.depthBiasSlope = value;
    }

    /**
     * Gets the offset for the output depth buffer value based on the slope of the triangle
     * relative to the camera.
     *
     * @type {number}
     */
    get slopeDepthBias() {
        return this._depthState.depthBiasSlope;
    }

    _shaderVersion = 0;

    _scene = null;

    dirty = true;

    /**
     * Sets whether the red channel is written to the color buffer. If true, the red component of
     * fragments generated by the shader of this material is written to the color buffer of the
     * currently active render target. If false, the red component will not be written. Defaults to
     * true.
     *
     * @type {boolean}
     */
    set redWrite(value) {
        this._blendState.redWrite = value;
    }

    /**
     * Gets whether the red channel is written to the color buffer.
     *
     * @type {boolean}
     */
    get redWrite() {
        return this._blendState.redWrite;
    }

    /**
     * Sets whether the green channel is written to the color buffer. If true, the red component of
     * fragments generated by the shader of this material is written to the color buffer of the
     * currently active render target. If false, the green component will not be written. Defaults
     * to true.
     *
     * @type {boolean}
     */
    set greenWrite(value) {
        this._blendState.greenWrite = value;
    }

    /**
     * Gets whether the green channel is written to the color buffer.
     *
     * @type {boolean}
     */
    get greenWrite() {
        return this._blendState.greenWrite;
    }

    /**
     * Sets whether the blue channel is written to the color buffer. If true, the red component of
     * fragments generated by the shader of this material is written to the color buffer of the
     * currently active render target. If false, the blue component will not be written. Defaults
     * to true.
     *
     * @type {boolean}
     */
    set blueWrite(value) {
        this._blendState.blueWrite = value;
    }

    /**
     * Gets whether the blue channel is written to the color buffer.
     *
     * @type {boolean}
     */
    get blueWrite() {
        return this._blendState.blueWrite;
    }

    /**
     * Sets whether the alpha channel is written to the color buffer. If true, the red component of
     * fragments generated by the shader of this material is written to the color buffer of the
     * currently active render target. If false, the alpha component will not be written. Defaults
     * to true.
     *
     * @type {boolean}
     */
    set alphaWrite(value) {
        this._blendState.alphaWrite = value;
    }

    /**
     * Gets whether the alpha channel is written to the color buffer.
     *
     * @type {boolean}
     */
    get alphaWrite() {
        return this._blendState.alphaWrite;
    }

    // returns boolean depending on material being transparent
    get transparent() {
        return this._blendState.blend;
    }

    _updateTransparency() {
        const transparent = this.transparent;
        const meshInstances = this.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            meshInstances[i].transparent = transparent;
        }
    }

    /**
     * Sets the blend state for this material. Controls how fragment shader outputs are blended
     * when being written to the currently active render target. This overwrites blending type set
     * using {@link Material#blendType}, and offers more control over blending.
     *
     * @type {BlendState}
     */
    set blendState(value) {
        this._blendState.copy(value);
        this._updateTransparency();
    }

    /**
     * Gets the blend state for this material.
     *
     * @type {BlendState}
     */
    get blendState() {
        return this._blendState;
    }

    /**
     * Sets the blend mode for this material. Controls how fragment shader outputs are blended when
     * being written to the currently active render target. Can be:
     *
     * - {@link BLEND_SUBTRACTIVE}: Subtract the color of the source fragment from the destination
     * fragment and write the result to the frame buffer.
     * - {@link BLEND_ADDITIVE}: Add the color of the source fragment to the destination fragment
     * and write the result to the frame buffer.
     * - {@link BLEND_NORMAL}: Enable simple translucency for materials such as glass. This is
     * equivalent to enabling a source blend mode of {@link BLENDMODE_SRC_ALPHA} and a destination
     * blend mode of {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}.
     * - {@link BLEND_NONE}: Disable blending.
     * - {@link BLEND_PREMULTIPLIED}: Similar to {@link BLEND_NORMAL} expect the source fragment is
     * assumed to have already been multiplied by the source alpha value.
     * - {@link BLEND_MULTIPLICATIVE}: Multiply the color of the source fragment by the color of the
     * destination fragment and write the result to the frame buffer.
     * - {@link BLEND_ADDITIVEALPHA}: Same as {@link BLEND_ADDITIVE} except the source RGB is
     * multiplied by the source alpha.
     * - {@link BLEND_MULTIPLICATIVE2X}: Multiplies colors and doubles the result.
     * - {@link BLEND_SCREEN}: Softer version of additive.
     * - {@link BLEND_MIN}: Minimum color.
     * - {@link BLEND_MAX}: Maximum color.
     *
     * Defaults to {@link BLEND_NONE}.
     *
     * @type {number}
     */
    set blendType(type) {

        const blendMode = blendModes[type];
        Debug.assert(blendMode, `Unknown blend mode ${type}`);
        this._blendState.setColorBlend(blendMode.op, blendMode.src, blendMode.dst);
        this._blendState.setAlphaBlend(blendMode.alphaOp ?? blendMode.op, blendMode.alphaSrc ?? blendMode.src, blendMode.alphaDst ?? blendMode.dst);

        const blend = type !== BLEND_NONE;
        if (this._blendState.blend !== blend) {
            this._blendState.blend = blend;
            this._updateTransparency();
        }
        this._updateMeshInstanceKeys();
    }

    /**
     * Gets the blend mode for this material.
     *
     * @type {number}
     */
    get blendType() {
        if (!this.transparent) {
            return BLEND_NONE;
        }

        const { colorOp, colorSrcFactor, colorDstFactor, alphaOp, alphaSrcFactor, alphaDstFactor } = this._blendState;

        for (let i = 0; i < blendModes.length; i++) {
            const blendMode = blendModes[i];
            if (blendMode.src === colorSrcFactor && blendMode.dst === colorDstFactor && blendMode.op === colorOp &&
                blendMode.src === alphaSrcFactor && blendMode.dst === alphaDstFactor && blendMode.op === alphaOp) {
                return i;
            }
        }

        return BLEND_NORMAL;
    }

    /**
     * Sets the depth state. Note that this can also be done by using {@link Material#depthTest},
     * {@link Material#depthFunc} and {@link Material#depthWrite}.
     *
     * @type {DepthState}
     */
    set depthState(value) {
        this._depthState.copy(value);
    }

    /**
     * Gets the depth state.
     *
     * @type {DepthState}
     */
    get depthState() {
        return this._depthState;
    }

    /**
     * Sets whether depth testing is enabled. If true, fragments generated by the shader of this
     * material are only written to the current render target if they pass the depth test. If
     * false, fragments generated by the shader of this material are written to the current render
     * target regardless of what is in the depth buffer. Defaults to true.
     *
     * @type {boolean}
     */
    set depthTest(value) {
        this._depthState.test = value;
    }

    /**
     * Gets whether depth testing is enabled.
     *
     * @type {boolean}
     */
    get depthTest() {
        return this._depthState.test;
    }

    /**
     * Sets the depth test function. Controls how the depth of new fragments is compared against
     * the current depth contained in the depth buffer. Can be:
     *
     * - {@link FUNC_NEVER}: don't draw
     * - {@link FUNC_LESS}: draw if new depth < depth buffer
     * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
     * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
     * - {@link FUNC_GREATER}: draw if new depth > depth buffer
     * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
     * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
     * - {@link FUNC_ALWAYS}: always draw
     *
     * Defaults to {@link FUNC_LESSEQUAL}.
     *
     * @type {number}
     */
    set depthFunc(value) {
        this._depthState.func = value;
    }

    /**
     * Gets the depth test function.
     *
     * @type {number}
     */
    get depthFunc() {
        return this._depthState.func;
    }

    /**
     * Sets whether depth writing is enabled. If true, fragments generated by the shader of this
     * material write a depth value to the depth buffer of the currently active render target. If
     * false, no depth value is written. Defaults to true.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        this._depthState.write = value;
    }

    /**
     * Gets whether depth writing is enabled.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthState.write;
    }

    /**
     * Copy a material.
     *
     * @param {Material} source - The material to copy.
     * @returns {Material} The destination material.
     */
    copy(source) {
        this.name = source.name;

        // Render states
        this.alphaTest = source.alphaTest;
        this.alphaToCoverage = source.alphaToCoverage;

        this._blendState.copy(source._blendState);
        this._depthState.copy(source._depthState);

        this.cull = source.cull;

        this.stencilFront = source.stencilFront?.clone();
        if (source.stencilBack) {
            this.stencilBack = source.stencilFront === source.stencilBack ? this.stencilFront : source.stencilBack.clone();
        }

        // Shader parameters
        this.clearParameters();
        for (const name in source.parameters) {
            if (source.parameters.hasOwnProperty(name)) {
                this._setParameterSimple(name, source.parameters[name].data);
            }
        }

        // defines
        this.defines.clear();
        source.defines.forEach((value, key) => this.defines.set(key, value));

        // shader chunks
        this._shaderChunks = source.hasShaderChunks ? new ShaderChunks() : null;
        this._shaderChunks?.copy(source._shaderChunks);

        return this;
    }

    /**
     * Clone a material.
     *
     * @returns {this} A newly cloned material.
     */
    clone() {
        const clone = new this.constructor();
        return clone.copy(this);
    }

    _updateMeshInstanceKeys() {
        const meshInstances = this.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            meshInstances[i].updateKey();
        }
    }

    updateUniforms(device, scene) {
        if (this._dirtyShader) {
            this.clearVariants();
        }
    }

    /**
     * @param {ShaderVariantParams} params - The parameters used to generate the shader variant.
     * @ignore
     */
    getShaderVariant(params) {
        Debug.assert(false, 'Not implemented');
    }

    /**
     * Applies any changes made to the material's properties.
     */
    update() {

        // handle deprecated chunks for backwards compatibility
        if (Object.keys(this._oldChunks).length > 0) {
            for (const [key, value] of Object.entries(this._oldChunks)) {
                this.shaderChunks.glsl.set(key, value);
                delete this._oldChunks[key];
            }
        }

        // if the defines or chunks were modified, we need to rebuild the shaders
        if (this._definesDirty || this._shaderChunks?.isDirty()) {
            this._definesDirty = false;
            this._shaderChunks?.resetDirty();

            this.clearVariants();
        }

        this.dirty = true;
    }

    // Parameter management
    clearParameters() {
        this.parameters = {};
    }

    getParameters() {
        return this.parameters;
    }

    clearVariants() {

        // clear variants on the material
        this.variants.clear();

        // but also clear them from all materials that reference them
        const meshInstances = this.meshInstances;
        const count = meshInstances.length;
        for (let i = 0; i < count; i++) {
            meshInstances[i].clearShaders();
        }
    }

    /**
     * Retrieves the specified shader parameter from a material.
     *
     * @param {string} name - The name of the parameter to query.
     * @returns {object} The named parameter.
     */
    getParameter(name) {
        return this.parameters[name];
    }

    _setParameterSimple(name, data) {

        Debug.call(() => {
            if (data === undefined) {
                Debug.warnOnce(`Material#setParameter: Attempting to set undefined data for parameter "${name}", this is likely not expected.`, this);
            }
        });

        const param = this.parameters[name];
        if (param) {
            param.data = data;
        } else {
            this.parameters[name] = {
                scopeId: null,
                data: data
            };
        }
    }

    /**
     * Sets a shader parameter on a material.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|ArrayBufferView|Texture|StorageBuffer} data - The value for the specified parameter.
     */
    setParameter(name, data) {

        if (data === undefined && typeof name === 'object') {
            const uniformObject = name;
            if (uniformObject.length) {
                for (let i = 0; i < uniformObject.length; i++) {
                    this.setParameter(uniformObject[i]);
                }
                return;
            }
            name = uniformObject.name;
            data = uniformObject.value;
        }

        this._setParameterSimple(name, data);
    }

    /**
     * Deletes a shader parameter on a material.
     *
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    }

    // used to apply parameters from this material into scope of uniforms, called internally by forward-renderer
    // optional list of parameter names to be set can be specified, otherwise all parameters are set
    setParameters(device, names) {
        const parameters = this.parameters;
        if (names === undefined) names = parameters;
        for (const paramName in names) {
            const parameter = parameters[paramName];
            if (parameter) {
                if (!parameter.scopeId) {
                    parameter.scopeId = device.scope.resolve(paramName);
                }
                parameter.scopeId.setValue(parameter.data);
            }
        }
    }

    /**
     * Adds or removes a define on the material. Defines can be used to enable or disable various
     * parts of the shader code.
     *
     * @param {string} name - The name of the define to set.
     * @param {string|undefined|boolean} value - The value of the define. If undefined or false, the
     * define is removed.
     *
     * A simple example on how to set a custom shader define value used by the shader processor.
     *
     * ```javascript
     * material.setDefine('MY_DEFINE', true);
     *
     * // call update to apply the changes, which will recompile the shader using the new define
     * material.update();
     * ```
     */
    setDefine(name, value) {
        let modified = false;
        const { defines } = this;

        if (value !== undefined && value !== false) {
            modified = !defines.has(name) || defines.get(name) !== value;
            defines.set(name, value);
        } else {
            modified = defines.has(name);
            defines.delete(name);
        }

        this._definesDirty ||= modified;
    }

    /**
     * Returns true if a define is enabled on the material, otherwise false.
     *
     * @param {string} name - The name of the define to check.
     * @returns {boolean} The value of the define.
     */
    getDefine(name) {
        return this.defines.has(name);
    }

    /**
     * Removes this material from the scene and possibly frees up memory from its shaders (if there
     * are no other materials using it).
     */
    destroy() {
        this.variants.clear();

        for (let i = 0; i < this.meshInstances.length; i++) {
            const meshInstance = this.meshInstances[i];
            meshInstance.clearShaders();
            meshInstance._material = null;

            if (meshInstance.mesh) {
                const defaultMaterial = getDefaultMaterial(meshInstance.mesh.device);
                if (this !== defaultMaterial) {
                    meshInstance.material = defaultMaterial;
                }
            } else {
                Debug.warn('pc.Material: MeshInstance.mesh is null, default material cannot be assigned to the MeshInstance');
            }
        }

        this.meshInstances.length = 0;
    }

    /**
     * Registers mesh instance as referencing the material.
     *
     * @param {MeshInstance} meshInstance - The mesh instance to register.
     * @ignore
     */
    addMeshInstanceRef(meshInstance) {
        this.meshInstances.push(meshInstance);
    }

    /**
     * De-registers mesh instance as referencing the material.
     *
     * @param {MeshInstance} meshInstance - The mesh instance to de-register.
     * @ignore
     */
    removeMeshInstanceRef(meshInstance) {
        const meshInstances = this.meshInstances;
        const i = meshInstances.indexOf(meshInstance);
        if (i !== -1) {
            meshInstances.splice(i, 1);
        }
    }
}

export { Material };
