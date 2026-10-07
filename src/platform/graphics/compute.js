import { Debug } from '../../core/debug.js';
import { PIXELFORMAT_R32F, PIXELFORMAT_RG32F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F } from './constants.js';
import { SceneColorMapHandle } from './scene-color-map-handle.js';
import { SceneDepthMapHandle } from './scene-depth-map-handle.js';
import { Shader } from './shader.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { IndexBuffer } from './index-buffer.js'
 * @import { StorageBuffer } from './storage-buffer.js'
 * @import { Texture } from './texture.js'
 * @import { TextureView } from './texture-view.js'
 * @import { Vec2 } from '../../core/math/vec2.js'
 * @import { VertexBuffer } from './vertex-buffer.js'
 */

// The resources the sceneDepthCS and sceneColorCS chunks declare. The compute instance assigns
// them from the attached scene maps itself, so they cannot be set as parameters.
const DEPTH_MAP = 'computeSceneDepthMap';
const DEPTH_CAMERA_PARAMS = 'computeSceneDepthCameraParams';
const DEPTH_VIEW_PROJECTION_INVERSE = 'computeSceneDepthViewProjectionInverse';
const DEPTH_VIEWPORT = 'computeSceneDepthViewport';
const COLOR_MAP = 'computeSceneColorMap';

const isSceneMapName = name => name === DEPTH_MAP || name === DEPTH_CAMERA_PARAMS ||
    name === DEPTH_VIEW_PROJECTION_INVERSE || name === DEPTH_VIEWPORT || name === COLOR_MAP;

// The bits of the key of the shader variant compiled for the attached scene maps, each matching a
// define the chunks are compiled with.
const VARIANT_DEPTH_LINEAR = 1;
const VARIANT_DEPTH_RECIPROCAL = 2;
const VARIANT_COLOR_UNFILTERABLE = 4;
const VARIANT_COLOR_GAMMA = 8;

/**
 * Adds the defines of a shader variant.
 *
 * @param {Map<string, string>} defines - The defines to add to.
 * @param {number} key - The key of the variant.
 */
const addVariantDefines = (defines, key) => {
    if (key & VARIANT_DEPTH_LINEAR) defines.set('SCENE_DEPTHMAP_LINEAR', '');
    if (key & VARIANT_DEPTH_RECIPROCAL) defines.set('SCENE_DEPTHMAP_RECIPROCAL', '');
    if (key & VARIANT_COLOR_UNFILTERABLE) defines.set('SCENE_COLORMAP_UNFILTERABLE', '');
    if (key & VARIANT_COLOR_GAMMA) defines.set('SCENE_COLORMAP_GAMMA', '');
};

/**
 * Returns true when a texture of the format cannot be sampled with filtering on the device.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {number} format - The pixel format.
 * @returns {boolean} True when the format is not filterable.
 */
const isUnfilterable = (device, format) => !device.textureFloatFilterable && (
    format === PIXELFORMAT_R32F || format === PIXELFORMAT_RG32F ||
    format === PIXELFORMAT_RGB32F || format === PIXELFORMAT_RGBA32F);

/**
 * A helper class storing a parameter value.
 *
 * @ignore
 */
class ComputeParameter {
    value;
}

/**
 * A representation of a compute shader with the associated resources, that can be executed on the
 * GPU. Only supported on WebGPU platform.
 *
 * Every uniform and resource the compute shader declares has to be given a value on the compute
 * instance, using {@link Compute#setParameter}. Values set globally on the scope of the graphics
 * device are not used. The scene depth and color maps of a camera are made available to the shader
 * using {@link Compute#setSceneDepthMap} and {@link Compute#setSceneColorMap}.
 *
 * A compute instance is dispatched at most once in a frame. To dispatch a compute shader more than
 * once in a frame, use a separate compute instance for each dispatch. The instances can share the
 * shader, which is compiled only once.
 *
 * Call {@link Compute#destroy} when no longer needed. The graphics device retains compute
 * instances for device recovery until they are explicitly destroyed.
 *
 * @category Graphics
 */
class Compute {
    /**
     * A compute shader.
     *
     * @type {Shader|null}
     * @ignore
     */
    shader = null;

    /**
     * The non-unique name of an instance of the class. Defaults to 'Unnamed'.
     *
     * @type {string}
     */
    name;

    /**
     * The shader the compute is dispatched with - the {@link Compute#shader} itself, or its variant
     * compiled for the attached scene maps.
     *
     * @type {Shader|null}
     * @ignore
     */
    activeShader = null;

    /**
     * @type {Map<string, ComputeParameter>}
     * @ignore
     */
    parameters = new Map();

    /**
     * Incremented when a parameter is added or deleted, so that the implementation knows to look up
     * the parameters of the bind group slots again.
     *
     * @type {number}
     * @ignore
     */
    parametersVersion = 0;

    /**
     * @type {SceneDepthMapHandle|null}
     * @private
     */
    _sceneDepthMap = null;

    /**
     * @type {SceneColorMapHandle|null}
     * @private
     */
    _sceneColorMap = null;

    /**
     * The key of the shader variant the compute is dispatched with, 0 for the shader itself.
     *
     * @type {number}
     * @private
     */
    _variantKey = 0;

    /**
     * The variants of the shader compiled for the scene maps the compute has been dispatched with,
     * keyed by their variant key. Created on first use, and destroyed with the compute.
     *
     * @type {Map<number, Shader>|null}
     * @private
     */
    _variants = null;

    /** @ignore */
    countX = 1;

    /**
     * @type {number|undefined}
     * @ignore
     */
    countY;

    /**
     * @type {number|undefined}
     * @ignore
     */
    countZ;

    /**
     * Slot index in the indirect dispatch buffer, or -1 for direct dispatch.
     *
     * @ignore
     */
    indirectSlotIndex = -1;

    /**
     * Custom buffer for indirect dispatch, or null to use device's built-in buffer.
     *
     * @type {StorageBuffer|null}
     * @ignore
     */
    indirectBuffer = null;

    /**
     * Frame stamp (device.renderVersion) when indirect slot was set. Used for validation
     * when using the built-in buffer.
     *
     * @ignore
     */
    indirectFrameStamp = 0;

    /**
     * Create a compute instance. Note that this is supported on WebGPU only and is a no-op on
     * other platforms.
     *
     * @param {GraphicsDevice} graphicsDevice
     * The graphics device.
     * @param {Shader} shader - The compute shader.
     * @param {string} [name] - The name of the compute instance, used for debugging only.
     */
    constructor(graphicsDevice, shader, name = 'Unnamed') {
        this.device = graphicsDevice;
        this.shader = shader;
        this.activeShader = shader;
        this.name = name;

        if (graphicsDevice.supportsCompute) {
            this.impl = graphicsDevice.createComputeImpl(this);
        }
    }

    /**
     * Sets a shader parameter on a compute instance. Every uniform and resource the compute shader
     * declares needs a value set this way.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|Float32Array|Texture|StorageBuffer|VertexBuffer|IndexBuffer|TextureView} value
     * The value for the specified parameter.
     */
    setParameter(name, value) {
        Debug.assert(!isSceneMapName(name), `Compute ${this.name}: the parameter ${name} is assigned from the scene map attached with setSceneDepthMap / setSceneColorMap, and cannot be set.`, this);
        this._setParameter(name, value);
    }

    /**
     * @param {string} name - The name of the parameter to set.
     * @param {*} value - The value.
     * @private
     */
    _setParameter(name, value) {
        let param = this.parameters.get(name);
        if (!param) {
            param = new ComputeParameter();
            this.parameters.set(name, param);
            this.parametersVersion++;
        }
        param.value = value;
    }

    /**
     * Returns the value of a shader parameter from the compute instance.
     *
     * @param {string} name - The name of the parameter to get.
     * @returns {number|number[]|Float32Array|Texture|StorageBuffer|VertexBuffer|IndexBuffer|TextureView|undefined}
     * The value of the specified parameter.
     */
    getParameter(name) {
        return this.parameters.get(name)?.value;
    }

    /**
     * Deletes a shader parameter from the compute instance.
     *
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        if (this.parameters.delete(name)) {
            this.parametersVersion++;
        }
    }

    /**
     * Attaches the scene depth map of a camera to this compute instance, making it available to
     * the compute shader, which accesses it using the functions of the `sceneDepthCS` chunk it
     * includes:
     *
     * - `sceneDepthSize() -> vec2u`: the dimensions of the depth map.
     * - `sceneDepthViewport() -> vec4u`: the viewport the camera rendered the depth map with, in
     * texels: the x and y of its first texel, and its width and height. A camera rendering to only a
     * part of its target, see {@link CameraComponent#rect}, covers only this part of the depth map.
     * - `sceneDepthNearClip() -> f32`, `sceneDepthFarClip() -> f32`: the clip planes the depth map
     * was rendered with.
     * - `sceneDepthLinear(texel: vec2i) -> f32`: the linear camera depth, in world units.
     * - `sceneDepthWorldPosition(texel: vec2i) -> vec3f`: the world position of the surface at the
     * texel, which needs to be within the viewport.
     *
     * The handle is kept, and the depth map it identifies is read each time the compute is
     * dispatched, so this only needs to be called once. A dispatch uses the depth map the camera
     * rendered most recently - when dispatched before the camera renders, for example from an
     * update event, that is the depth map of the previous frame. However the camera stored the
     * depth, it is decoded with the camera parameters it was rendered with.
     *
     * The camera only renders the depth map when requested, see
     * {@link CameraComponent#requestSceneDepthMap}, or when its {@link CameraFrame} is configured to.
     *
     * @param {SceneDepthMapHandle|null} handle - The handle to the scene depth map of a camera, see
     * {@link CameraComponent#sceneDepthMapHandle}, or null to detach the depth map.
     * @example
     * // the compute shader includes the chunk, for example:
     * //     #include "sceneDepthCS"
     * //     let position = sceneDepthWorldPosition(vec2i(id.xy));
     * cameraEntity.camera.requestSceneDepthMap(true);
     * compute.setSceneDepthMap(cameraEntity.camera.sceneDepthMapHandle);
     */
    setSceneDepthMap(handle) {
        Debug.assert(handle === null || handle instanceof SceneDepthMapHandle, `Compute ${this.name}: setSceneDepthMap expects a SceneDepthMapHandle or null.`, this);
        Debug.assert(!handle || this._declares(DEPTH_MAP), `Compute ${this.name}: a scene depth map is attached, but the shader does not include the sceneDepthCS chunk to access it.`, this);

        this._sceneDepthMap = handle;
        if (!handle) {
            this.deleteParameter(DEPTH_MAP);
            this.deleteParameter(DEPTH_CAMERA_PARAMS);
            this.deleteParameter(DEPTH_VIEW_PROJECTION_INVERSE);
            this.deleteParameter(DEPTH_VIEWPORT);
        }
    }

    /**
     * Attaches the scene color map of a camera to this compute instance, making it available to
     * the compute shader, which accesses it using the functions of the `sceneColorCS` chunk it
     * includes:
     *
     * - `sceneColorSize(lod: i32) -> vec2u`: the dimensions of a mip level of the color map.
     * - `sceneColorLoad(texel: vec2i, lod: i32) -> vec4f`: the color of a texel.
     * - `sceneColorSample(uv: vec2f, lod: f32) -> vec4f`: the color sampled with filtering. When
     * the format of the color map cannot be filtered on the device, the nearest texel is returned.
     * - `sceneColorToLinear(color: vec3f) -> vec3f`: converts a color to linear.
     * - `sceneColorToDisplay(color: vec3f) -> vec3f`: converts a color to gamma encoded.
     *
     * The colors are returned the way the camera stored them - linear when it renders without gamma
     * correction, as it does when using {@link CameraFrame}, and gamma encoded otherwise.
     * `SCENE_COLORMAP_GAMMA` is defined in the shader when they are gamma encoded, and the
     * conversion functions do nothing when the color is already in the requested space.
     *
     * The handle is kept, and the color map it identifies is read each time the compute is
     * dispatched, so this only needs to be called once. A dispatch uses the color map the camera
     * rendered most recently - when dispatched before the camera renders, for example from an
     * update event, that is the color map of the previous frame.
     *
     * The camera only renders the color map when requested, see
     * {@link CameraComponent#requestSceneColorMap}, or when its {@link CameraFrame} is configured to.
     *
     * @param {SceneColorMapHandle|null} handle - The handle to the scene color map of a camera, see
     * {@link CameraComponent#sceneColorMapHandle}, or null to detach the color map.
     * @example
     * // the compute shader includes the chunk, for example:
     * //     #include "sceneColorCS"
     * //     let color = sceneColorToLinear(sceneColorLoad(vec2i(id.xy), 0).rgb);
     * cameraEntity.camera.requestSceneColorMap(true);
     * compute.setSceneColorMap(cameraEntity.camera.sceneColorMapHandle);
     */
    setSceneColorMap(handle) {
        Debug.assert(handle === null || handle instanceof SceneColorMapHandle, `Compute ${this.name}: setSceneColorMap expects a SceneColorMapHandle or null.`, this);
        Debug.assert(!handle || this._declares(COLOR_MAP), `Compute ${this.name}: a scene color map is attached, but the shader does not include the sceneColorCS chunk to access it.`, this);

        this._sceneColorMap = handle;
        if (!handle) {
            this.deleteParameter(COLOR_MAP);
        }
    }

    /**
     * Returns true when the shader declares a texture of the given name.
     *
     * @param {string} name - The name of the texture.
     * @returns {boolean} True when the shader declares it.
     * @private
     */
    _declares(name) {
        const impl = this.shader?.impl;
        return !impl || // nothing to check against without a compute backend
            !!impl.computeReflectedBindGroupFormat?.textureFormatsMap.has(name) ||
            !!impl.computeBindGroupFormat?.textureFormatsMap.has(name);
    }

    /**
     * Frees resources associated with this compute instance.
     */
    destroy() {
        this.impl?.destroy();
        this.impl = null;

        this._variants?.forEach(variant => variant.destroy());
        this._variants = null;
    }

    /**
     * Prepares the compute for a dispatch which is about to be recorded. The attached scene maps
     * are read now, as this is the point in the frame the dispatch runs at, assigned to the
     * resources of the chunks accessing them, and the shader variant matching how they are stored
     * is selected.
     *
     * @ignore
     */
    prepareDispatch() {
        const depthHandle = this._sceneDepthMap;
        const colorHandle = this._sceneColorMap;

        let key = 0;

        if (depthHandle) {
            Debug.assert(!depthHandle.destroyed, `Compute ${this.name}: the camera of the attached scene depth map has been destroyed. Detach it with setSceneDepthMap(null).`, this);
            Debug.assert(!depthHandle.packed, `Compute ${this.name}: a packed scene depth map is not supported.`, this);

            if (depthHandle.linear) key |= VARIANT_DEPTH_LINEAR;
            if (depthHandle.reciprocal) key |= VARIANT_DEPTH_RECIPROCAL;

            this._setParameter(DEPTH_MAP, this._sceneMapTexture(depthHandle, 'depth', 'white'));
            this._setParameter(DEPTH_CAMERA_PARAMS, depthHandle.cameraParams);
            this._setParameter(DEPTH_VIEW_PROJECTION_INVERSE, depthHandle.viewProjectionInverse.data);
            this._setParameter(DEPTH_VIEWPORT, depthHandle.viewport);
        }

        if (colorHandle) {
            Debug.assert(!colorHandle.destroyed, `Compute ${this.name}: the camera of the attached scene color map has been destroyed. Detach it with setSceneColorMap(null).`, this);

            const texture = this._sceneMapTexture(colorHandle, 'color', 'pink');
            if (isUnfilterable(this.device, texture.format)) key |= VARIANT_COLOR_UNFILTERABLE;
            if (colorHandle.gamma) key |= VARIANT_COLOR_GAMMA;

            this._setParameter(COLOR_MAP, texture);
        }

        if (key !== this._variantKey) {
            this._setVariant(key);
        }
    }

    /**
     * Returns the texture to bind for a scene map. In place of a map the camera has not rendered, a
     * substitute is bound and the omission reported. A substitute is also bound in place of a map
     * whose texture has since been destroyed, as happens when the way a camera renders its maps
     * changes, until the camera publishes the next one - which is expected, and not reported.
     * Neither is a destroyed camera, which the caller reports.
     *
     * @param {SceneDepthMapHandle|SceneColorMapHandle} handle - The handle to the map.
     * @param {string} kind - The kind of the map, for the report.
     * @param {string} substitute - The name of the built-in texture to bind.
     * @returns {Texture} The texture to bind.
     * @private
     */
    _sceneMapTexture(handle, kind, substitute) {
        const texture = handle.texture;
        if (texture?.device) {
            return texture;
        }

        Debug.call(() => {
            if (!texture && !handle.destroyed) {
                Debug.warnOnce(`Compute ${this.name}: the camera of the attached scene ${kind} map has not rendered it. A camera only renders it when requested, using CameraComponent#requestScene${kind === 'depth' ? 'Depth' : 'Color'}Map, or when its CameraFrame is configured to.`);
            }
        });
        return this.device.builtInTextures[substitute];
    }

    /**
     * Switches the compute to the shader variant of the key, recreating the implementation for it.
     * The parameters are kept, as they are stored on the compute itself.
     *
     * @param {number} key - The key of the variant.
     * @private
     */
    _setVariant(key) {
        this._variantKey = key;

        let shader = this.shader;
        if (key !== 0) {
            this._variants ??= new Map();
            shader = this._variants.get(key);
            if (!shader) {
                // compiled from the definition the shader was created with, and the variant defines
                const definition = this.shader.computeDefinition;
                const cdefines = new Map(definition.cdefines);
                addVariantDefines(cdefines, key);
                shader = new Shader(this.device, { ...definition, name: `${this.shader.name}-${key}`, cdefines });
                this._variants.set(key, shader);
            }
        }

        if (shader !== this.activeShader) {
            this.activeShader = shader;
            if (this.impl) {
                this.impl.destroy();
                this.impl = this.device.createComputeImpl(this);
            }
        }
    }

    /**
     * Prepare the compute work dispatch.
     *
     * @param {number} x - X dimension of the grid of work-groups to dispatch.
     * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
     * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
     */
    setupDispatch(x, y, z) {
        this.countX = x;
        this.countY = y;
        this.countZ = z;

        // reset indirect dispatch state
        this.indirectSlotIndex = -1;
        this.indirectBuffer = null;
    }

    /**
     * Prepare the compute work dispatch to use indirect parameters from a buffer. The dispatch
     * parameters (x, y, z workgroup counts) are read from the buffer at the specified slot index.
     *
     * When using the device's built-in buffer (buffer parameter is null), this method must be
     * called each frame as slots are only valid for the current frame.
     *
     * @param {number} slotIndex - Slot index in the indirect dispatch buffer. When using the
     * device's built-in buffer, obtain this by calling {@link GraphicsDevice#getIndirectDispatchSlot}.
     * @param {StorageBuffer|null} [buffer] - Optional custom storage buffer containing dispatch
     * parameters. If not provided, uses the device's built-in {@link GraphicsDevice#indirectDispatchBuffer}.
     * When providing a custom buffer, the user is responsible for its lifetime and contents.
     * @example
     * // Reserve a slot in the indirect dispatch buffer
     * const slot = device.getIndirectDispatchSlot();
     *
     * // First compute shader writes dispatch parameters to the buffer
     * prepareCompute.setParameter('indirectBuffer', device.indirectDispatchBuffer);
     * prepareCompute.setParameter('slot', slot);
     * prepareCompute.setupDispatch(1, 1, 1);
     * device.computeDispatch([prepareCompute]);
     *
     * // Second compute shader uses indirect dispatch
     * processCompute.setupIndirectDispatch(slot);
     * device.computeDispatch([processCompute]);
     */
    setupIndirectDispatch(slotIndex, buffer = null) {
        this.indirectSlotIndex = slotIndex;
        this.indirectBuffer = buffer;
        this.indirectFrameStamp = this.device.renderVersion;
    }

    /**
     * Calculate near-square 2D dispatch dimensions for a given workgroup count,
     * respecting the WebGPU per-dimension limit. When the count fits within a single
     * dimension, Y is 1. Otherwise, dimensions are chosen to be roughly square to
     * minimize wasted padding threads.
     *
     * @param {number} count - Total number of workgroups needed.
     * @param {Vec2} result - Output vector to receive X (x) and Y (y) dimensions.
     * @param {number} [maxDimension] - Maximum workgroups per dimension.
     * @returns {Vec2} The result vector with dimensions set.
     * @ignore
     */
    static calcDispatchSize(count, result, maxDimension = 65535) {
        if (count <= maxDimension) {
            return result.set(count, 1);
        }
        const y = Math.ceil(count / maxDimension);
        return result.set(Math.ceil(count / y), y);
    }
}

export { Compute };
