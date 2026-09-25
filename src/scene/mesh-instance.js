import { Debug, DebugHelper } from '../core/debug.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { BindGroup } from '../platform/graphics/bind-group.js';
import { UniformBuffer } from '../platform/graphics/uniform-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { DrawCommands } from '../platform/graphics/draw-commands.js';
import { indexFormatByteSize } from '../platform/graphics/constants.js';
import {
    LAYER_WORLD,
    MASK_AFFECT_DYNAMIC, MASK_BAKE, MASK_AFFECT_LIGHTMAPPED,
    RENDERSTYLE_SOLID,
    SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, SHADERDEF_NOSHADOW, SHADERDEF_SKIN,
    SHADERDEF_SCREENSPACE, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_BATCH,
    SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, SHADERDEF_INSTANCING, SHADERDEF_MORPH_TEXTURE_BASED_INT,
    SHADOW_CASCADE_ALL,
    instanceLightmapUniformNames
} from './constants.js';
import { GraphNode } from './graph-node.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { getMutatedOverrides, initMeshInstanceDebug, recordAppliedOverrides, warnMutatedOverrides } from './materials/material-debug.js';
import { LightmapCache } from './graphics/lightmap-cache.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { hash32Fnv1a } from '../core/hash.js';
import { array } from '../core/array-utils.js';
import { PickerId } from './picker-id.js';
import { isViewTexture } from './renderer/view-textures.js';

/**
 * @import { Camera } from './camera.js'
 * @import { GSplatInstance } from './gsplat/gsplat-instance.js'
 * @import { GraphicsDevice } from '../platform/graphics/graphics-device.js'
 * @import { Material } from './materials/material.js'
 * @import { Mesh } from './mesh.js'
 * @import { MorphInstance } from './morph-instance.js'
 * @import { CameraShaderParams } from './camera-shader-params.js'
 * @import { LightList } from './lighting/light-list.js'
 * @import { Scene } from './scene.js'
 * @import { UniformFormat } from '../platform/graphics/uniform-buffer-format.js'
 * @typedef {object} MeshInstanceParameter - A parameter of a mesh instance, overriding the value of
 * the material for that instance.
 * @property {string} name - The name of the uniform.
 * @property {*} data - The value.
 * @property {ScopeId|null} scopeId - The scope id, resolved on first use for scope parameters.
 * @property {boolean} override - True when the uniform is stored in the material uniform buffer, so
 * the parameter is applied through the mesh instance's copy of it rather than through the scope.
 * @property {UniformFormat|null} uniformFormat - The format of the uniform in the material uniform
 * buffer, resolved on first use for overrides.
 * @property {number} textureSlot - The index of the texture slot of the material bind group the
 * parameter overrides, or -1 when it does not override a texture of the material.
 * @ignore
 * @import { ScopeId } from '../platform/graphics/scope-id.js'
 * @import { Shader } from '../platform/graphics/shader.js'
 * @import { SkinInstance } from './skin-instance.js'
 * @import { StencilParameters } from '../platform/graphics/stencil-parameters.js'
 * @import { Texture } from '../platform/graphics/texture.js'
 * @import { UniformBufferFormat } from '../platform/graphics/uniform-buffer-format.js'
 * @import { Vec3 } from '../core/math/vec3.js'
 * @import { CameraComponent } from '../framework/components/camera/component.js';
 */

const _tmpAabb = new BoundingBox();
const _tempBoneAabb = new BoundingBox();

/** @type {Set<Mesh>} */
const _meshSet = new Set();

// internal array used to evaluate the hash for the shader instance
const lookupHashes = new Uint32Array(5);

/**
 * Internal data structure used to store data used by hardware instancing.
 *
 * @ignore
 */
class InstancingData {
    /** @type {VertexBuffer|null} */
    vertexBuffer = null;

    /**
     * True if the vertex buffer is destroyed when the mesh instance is destroyed.
     */
    _destroyVertexBuffer = false;

    /**
     * @param {number} numObjects - The number of objects instanced.
     */
    constructor(numObjects) {
        this.count = numObjects;
    }

    destroy() {
        if (this._destroyVertexBuffer) {
            this.vertexBuffer?.destroy();
        }
        this.vertexBuffer = null;
    }
}

/**
 * Internal helper class for storing the shader and related mesh bind group in the shader cache.
 *
 * @ignore
 */
class ShaderInstance {
    /**
     * A shader.
     *
     * @type {Shader|undefined}
     */
    shader;

    /**
     * A bind group storing mesh textures / samplers for the shader. but not the uniform buffer.
     *
     * @type {BindGroup|null}
     */
    bindGroup = null;

    /**
     * A uniform buffer storing mesh uniforms for the shader.
     *
     * @type {UniformBuffer|null}
     */
    uniformBuffer = null;

    /**
     * The full array of hashes used to lookup the pipeline, used in case of hash collision.
     *
     * @type {Uint32Array}
     */
    hashes;

    /**
     * Returns the mesh bind group for the shader.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {BindGroup} - The mesh bind group.
     */
    getBindGroup(device) {

        // create bind group
        if (!this.bindGroup) {
            const shader = this.shader;
            Debug.assert(shader);

            const bindGroupFormat = shader.meshBindGroupFormat;
            Debug.assert(bindGroupFormat);
            this.bindGroup = new BindGroup(device, bindGroupFormat);
            DebugHelper.setName(this.bindGroup, `MeshBindGroup_${this.bindGroup.id}`);
        }

        return this.bindGroup;
    }

    /**
     * Returns the uniform buffer for the shader.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {UniformBuffer} - The uniform buffer.
     */
    getUniformBuffer(device) {

        // create uniform buffer
        if (!this.uniformBuffer) {
            const shader = this.shader;
            Debug.assert(shader);

            const ubFormat = shader.meshUniformBufferFormat;
            Debug.assert(ubFormat);
            this.uniformBuffer = new UniformBuffer(device, ubFormat, false);
        }

        return this.uniformBuffer;
    }

    destroy() {
        this.bindGroup?.destroy();
        this.bindGroup = null;

        this.uniformBuffer?.destroy();
        this.uniformBuffer = null;
    }
}

/**
 * @callback CalculateSortDistanceCallback
 * Callback used by {@link Layer} to calculate the "sort distance" for a {@link MeshInstance},
 * which determines its place in the render order.
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {Vec3} cameraPosition - The position of the camera.
 * @param {Vec3} cameraForward - The forward vector of the camera.
 * @returns {number} The sort distance for the mesh instance. Mesh instances are sorted by this
 * value in ascending or descending order depending on the layer's sort mode.
 */

/**
 * An instance of a {@link Mesh}. A single mesh can be referenced by many mesh instances that can
 * have different transforms and materials.
 *
 * A mesh instance is created from a {@link Mesh}, a {@link Material} and the {@link GraphNode}
 * whose world transform places it, and it is drawn only once it belongs to a {@link Layer}.
 * Components such as {@link RenderComponent} create mesh instances from their assets and add them
 * to the layers in their `layers` list. A mesh instance you construct yourself is placed either
 * by assigning it to {@link RenderComponent#meshInstances} or by adding it to a layer directly
 * with {@link Layer#addMeshInstances}.
 *
 * Per-instance rendering state lives here rather than on the shared mesh or material:
 * {@link visible}, {@link castShadow} and `receiveShadow`, {@link cull} for frustum culling,
 * {@link drawOrder} for manual sorting, and {@link setParameter} for shader uniforms that override
 * the material's. {@link aabb} is the world-space bounds derived from the mesh bounds and the
 * node's transform, and can be assigned to override it.
 *
 * ### Instancing
 *
 * Hardware instancing lets the GPU draw many copies of the same geometry with a single draw call.
 * Use {@link setInstancing} to attach a vertex buffer that holds per-instance data
 * (for example a mat4 world-matrix for every instance). Set {@link instancingCount}
 * to control how many instances are rendered. Passing `null` to {@link setInstancing}
 * disables instancing once again.
 *
 * ```javascript
 * // vb is a vertex buffer with one 4×4 matrix per instance
 * meshInstance.setInstancing(vb);
 * meshInstance.instancingCount = numInstances;
 * ```
 *
 * The default matrix format, {@link VertexFormat.getDefaultInstancingFormat}, occupies the
 * attribute locations of `TEXCOORD6` and `TEXCOORD7`. A material sampling those UV sets on an
 * instanced mesh needs a custom instancing vertex format on other attributes, as shown by the
 * instancing-custom example.
 *
 * **Examples**
 *
 * - {@link https://playcanvas.github.io/#graphics/instancing-basic graphics/instancing-basic}
 * - {@link https://playcanvas.github.io/#graphics/instancing-custom graphics/instancing-custom}
 *
 * ### GPU-Driven Indirect Rendering (WebGPU Only)
 *
 * Instead of issuing draw calls from the CPU, parameters are written into a GPU
 * storage buffer and executed via indirect draw commands. Allocate one or more slots with
 * `GraphicsDevice.getIndirectDrawSlot(count)`, then bind the mesh instance to those slots:
 *
 * ```javascript
 * const slot = app.graphicsDevice.getIndirectDrawSlot(count);
 * meshInstance.setIndirect(null, slot, count); // first arg can be a CameraComponent or null
 * ```
 *
 * **Example**
 *
 * - {@link https://playcanvas.github.io/#compute/indirect-draw compute/indirect-draw}
 *
 * ### Multi-draw
 *
 * Multi-draw lets the engine submit multiple sub-draws with a single API call. On WebGL2 this maps
 * to the `WEBGL_multi_draw` extension; on WebGPU, to indirect multi-draw. Use {@link setMultiDraw}
 * to allocate a {@link DrawCommands} container, fill it with sub-draws using
 * {@link DrawCommands#add} and finalize with {@link DrawCommands#update} whenever the data changes.
 *
 * Support: {@link GraphicsDevice#supportsMultiDraw} is true on WebGPU and commonly true on WebGL2
 * (high coverage). When not supported, the engine can still render by issuing a fast internal loop
 * of single draws using the multi-draw data.
 *
 * ```javascript
 * // two indexed sub-draws from a single mesh
 * const cmd = meshInstance.setMultiDraw(null, 2);
 * cmd.add(0, 36, 1, 0);
 * cmd.add(1, 60, 1, 36);
 * cmd.update(2);
 * ```
 *
 * ### Precedence
 *
 * When draw commands (indirect or multi-draw, see {@link setIndirect} and {@link setMultiDraw})
 * are bound, they are the source of truth for rendering: the number of draws and the per-draw
 * instance counts come from the draw commands, and {@link instancingCount} is ignored. In this
 * case setting {@link instancingCount} to 0 does not skip rendering. {@link instancingCount} only
 * takes effect for plain hardware instancing, when no draw commands are bound.
 *
 * @category Graphics
 */
class MeshInstance {
    /**
     * Enable shadow casting for this mesh instance. Use this property to enable/disable shadow
     * casting without overhead of removing from scene. Note that this property does not add the
     * mesh instance to appropriate list of shadow casters on a {@link Layer}, but allows mesh to
     * be skipped from shadow casting while it is in the list already. Defaults to false.
     */
    castShadow = false;

    /**
     * Specifies a bitmask that controls which shadow cascades a mesh instance contributes
     * to when rendered with a {@link LIGHTTYPE_DIRECTIONAL} light source.
     * This setting is only effective if the {@link castShadow} property is enabled.
     * Defaults to {@link SHADOW_CASCADE_ALL}, which means the mesh casts shadows into all available cascades.
     *
     * @type {number}
     */
    shadowCascadeMask = SHADOW_CASCADE_ALL;

    /**
     * Controls whether the mesh instance can be culled by frustum culling (see
     * {@link CameraComponent#frustumCulling}). Defaults to true.
     */
    cull = true;

    /**
     * Determines the rendering order of mesh instances. Only used when mesh instances are added to
     * a {@link Layer} with {@link Layer#opaqueSortMode} or {@link Layer#transparentSortMode}
     * (depending on the material) set to {@link SORTMODE_MANUAL}.
     */
    drawOrder = 0;

    /** @ignore */
    _drawBucket = 127;

    /**
     * The graph node defining the transform for this instance.
     *
     * @type {GraphNode}
     */
    node;

    /**
     * Enable rendering for this mesh instance. Use visible property to enable/disable rendering
     * without overhead of removing from scene. But note that the mesh instance is still in the
     * hierarchy and still in the draw call list.
     */
    visible = true;

    /**
     * A bitmask controlling which shader passes this mesh instance is rendered in. Bit N
     * corresponds to the shader pass with index N: the built-in forward pass is
     * {@link SHADER_FORWARD}, and indices for custom shader passes are obtained from
     * {@link CameraComponent#setShaderPass}. Defaults to `0xFFFFFFFF` (all passes). For example,
     * clearing the forward pass bit keeps the mesh in the other passes (such as the camera depth
     * prepass that feeds Depth of Field) while making it invisible in the rendered color image.
     *
     * @type {number}
     * @example
     * // clear the forward (color) pass bit, leaving all other pass bits set: the mesh is no longer
     * // drawn in the color image, but still takes part in the other passes (such as the prepass)
     * meshInstance.shaderPassMask &= ~(1 << SHADER_FORWARD);
     * @example
     * // set the forward (color) pass bit, leaving all other pass bits unchanged
     * meshInstance.shaderPassMask |= (1 << SHADER_FORWARD);
     * @example
     * // exclude the mesh from a custom shader pass set up on the camera (see
     * // CameraComponent#setShaderPass), leaving all other pass bits set
     * const customPass = cameraComponent.setShaderPass('custom_rendering');
     * meshInstance.shaderPassMask &= ~(1 << customPass);
     * @example
     * // test whether the forward (color) pass bit is set
     * const forwardBitSet = (meshInstance.shaderPassMask & (1 << SHADER_FORWARD)) !== 0;
     * @example
     * // set every pass bit (the default value)
     * meshInstance.shaderPassMask = 0xFFFFFFFF;
     */
    shaderPassMask = 0xFFFFFFFF;

    /**
     * Read this value in the {@link Scene.EVENT_POSTCULL} event to determine if the object is
     * actually going to be rendered.
     */
    visibleThisFrame = false;

    /**
     * Negative scale batching support.
     *
     * @ignore
     */
    flipFacesFactor = 1;

    /**
     * @type {GSplatInstance|null}
     * @ignore
     */
    gsplatInstance = null;

    /** @ignore */
    id = PickerId.get();

    /**
     * Custom function used to customize culling (e.g. for 2D UI elements).
     *
     * @type {Function|null}
     * @ignore
     */
    isVisibleFunc = null;

    /**
     * @type {InstancingData|null}
     * @ignore
     */
    instancingData = null;

    /**
     * Map of {@link Camera#id} to the draw commands bound to that camera, with the null key
     * holding the commands shared by all cameras. Lazily allocated. Keyed by id rather than by
     * camera so a long-lived mesh instance cannot retain a camera, and with it the camera's node
     * hierarchy and render target.
     *
     * @type {Map<number|null, DrawCommands>|null}
     * @ignore
     */
    drawCommands = null;

    /**
     * Stores mesh metadata used for indirect rendering. Lazily allocated on first access
     * via getIndirectMetaData().
     *
     * @type {Int32Array|null}
     * @ignore
     */
    meshMetaData = null;

    /**
     * The parameters overriding the material values for this mesh instance, by name. A parameter
     * naming the uniform of a typed material property is applied through a per-instance copy of the
     * material uniform buffer (an override), any other parameter is set on the scope before the
     * draw. The two groups are also kept in dense lists for the render loop.
     *
     * @type {Map<string, MeshInstanceParameter>}
     * @ignore
     */
    parameters = new Map();

    /**
     * The parameters set on the scope before the draw.
     *
     * @type {MeshInstanceParameter[]}
     * @private
     */
    _scopeParameters = [];

    /**
     * The parameters overriding uniforms of the material uniform buffer.
     *
     * @type {MeshInstanceParameter[]}
     * @private
     */
    _materialOverrides = [];

    /**
     * The parameters overriding textures of the material bind group.
     *
     * @type {MeshInstanceParameter[]}
     * @private
     */
    _materialTextureOverrides = [];

    /**
     * The layout version of the material the parameters were last split against, see
     * {@link Material#layoutVersion}.
     *
     * @type {number}
     * @private
     */
    _materialLayoutVersion = -1;

    /**
     * Incremented when an override of the material uniform buffer is added, removed or changed.
     *
     * @type {number}
     * @private
     */
    _materialOverridesVersion = 0;

    /**
     * The per-instance copy of the material uniform buffer with the overrides applied, created on
     * first use, or null.
     *
     * @type {UniformBuffer|null}
     * @private
     */
    _materialUniformBuffer = null;

    /**
     * The bind group holding {@link MeshInstance#_materialUniformBuffer}.
     *
     * @type {BindGroup|null}
     * @private
     */
    _materialBindGroup = null;

    /**
     * The material uniform data version the copy was last synchronized with.
     *
     * @type {number}
     * @private
     */
    _syncedMaterialDataVersion = -1;

    /**
     * The overrides version the copy was last synchronized with.
     *
     * @type {number}
     * @private
     */
    _syncedOverridesVersion = -1;

    /**
     * True if the mesh instance is pickable by the {@link Picker}. Defaults to true.
     *
     * @ignore
     */
    pick = true;

    /**
     * The stencil parameters for front faces or null if no stencil is enabled.
     *
     * @type {StencilParameters|null}
     * @ignore
     */
    stencilFront = null;

    /**
     * The stencil parameters for back faces or null if no stencil is enabled.
     *
     * @type {StencilParameters|null}
     * @ignore
     */
    stencilBack = null;

    /**
     * True if the material of the mesh instance is transparent. Optimization to avoid accessing
     * the material. Updated by the material instance itself.
     *
     * @ignore
     */
    transparent = false;

    /** @private */
    _aabb = new BoundingBox();

    /** @private */
    _aabbVer = -1;

    /** @private */
    _aabbMeshVer = -1;

    /**
     * @type {BoundingBox|null}
     * @private
     */
    _customAabb = null;

    /** @private */
    _updateAabb = true;

    /** @private */
    _updateAabbFunc = null;

    /**
     * The internal sorting key used by the shadow renderer: the id of the shadow shader the mesh
     * instance was last rendered with, scaled above the 22 bits of the id of its material.
     *
     * @ignore
     */
    _sortKeyShadow = 0;

    /**
     * The internal sorting key used by the forward renderer, in case SORTMODE_MATERIALMESH sorting
     * is used.
     *
     * @private
     */
    _sortKeyForward = 0;

    /**
     * The internal sorting key used by the forward renderer, in case SORTMODE_BACK2FRONT or
     * SORTMODE_FRONT2BACK sorting is used.
     *
     * @ignore
     */
    _sortKeyDynamic = 0;

    /** @private */
    _layer = LAYER_WORLD;

    /**
     * @type {Material|null}
     * @private
     */
    _material = null;

    /**
     * @type {SkinInstance|null}
     * @private
     */
    _skinInstance = null;

    /**
     * @type {MorphInstance|null}
     * @private
     */
    _morphInstance = null;

    /** @private */
    _receiveShadow = true;

    /** @private */
    _renderStyle = RENDERSTYLE_SOLID;

    /** @private */
    _screenSpace = false;

    /**
     * The cache of shaders, indexed by a hash value.
     *
     * @type {Map<number, ShaderInstance>}
     * @private
     */
    _shaderCache = new Map();

    /**
     * 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = MASK_AFFECT_DYNAMIC
     *
     * @private
     */
    _shaderDefs = MASK_AFFECT_DYNAMIC << 16;

    /**
     * @type {CalculateSortDistanceCallback|null}
     * @private
     */
    _calculateSortDistance = null;

    /**
     * Create a new MeshInstance instance.
     *
     * @param {Mesh} mesh - The graphics mesh to instance.
     * @param {Material} material - The material to use for this mesh instance.
     * @param {GraphNode} [node] - The graph node defining the transform for this instance. This
     * parameter is optional when used with {@link RenderComponent} and will use the node the
     * component is attached to.
     * @example
     * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
     * const mesh = Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
     * const material = new StandardMaterial();
     *
     * const meshInstance = new MeshInstance(mesh, material);
     *
     * const entity = new Entity();
     * entity.addComponent('render', {
     *     meshInstances: [meshInstance]
     * });
     *
     * // Add the entity to the scene hierarchy
     * this.app.scene.root.addChild(entity);
     */
    constructor(mesh, material, node = null) {
        Debug.assert(!(mesh instanceof GraphNode), 'Incorrect parameters for MeshInstance\'s constructor. Use new MeshInstance(mesh, material, node)');
        Debug.call(() => initMeshInstanceDebug(this));

        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;          // The mesh that this instance renders
        mesh.incRefCount();
        this.material = material;   // The material with which to render this instance

        if (mesh.vertexBuffer) {
            const format = mesh.vertexBuffer.format;
            this._shaderDefs |= format.hasUv(0) ? SHADERDEF_UV0 : 0;
            this._shaderDefs |= format.hasUv(1) ? SHADERDEF_UV1 : 0;
            this._shaderDefs |= format.hasColor ? SHADERDEF_VCOLOR : 0;
            this._shaderDefs |= format.hasTangents ? SHADERDEF_TANGENTS : 0;
        }

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();
    }

    /**
     * Sets the draw bucket for mesh instances. The draw bucket, an integer from 0 to 255 (default
     * 127), serves as the primary sort key for mesh rendering. Meshes are sorted by draw bucket,
     * then by sort mode. This setting is only effective when mesh instances are added to a
     * {@link Layer} with its {@link Layer#opaqueSortMode} or {@link Layer#transparentSortMode}
     * (depending on the material) set to {@link SORTMODE_BACK2FRONT}, {@link SORTMODE_FRONT2BACK},
     * or {@link SORTMODE_MATERIALMESH}.
     *
     * Note: When {@link SORTMODE_BACK2FRONT} is used, a descending sort order is used; otherwise,
     * an ascending sort order is used.
     *
     * @type {number}
     */
    set drawBucket(bucket) {
        // 8bit integer
        this._drawBucket = Math.floor(bucket) & 0xff;
        this.updateKey();
    }

    /**
     * Gets the draw bucket for mesh instance.
     *
     * @type {number}
     */
    get drawBucket() {
        return this._drawBucket;
    }

    /**
     * Sets the render style of the mesh instance. Can be:
     *
     * - {@link RENDERSTYLE_SOLID}
     * - {@link RENDERSTYLE_WIREFRAME}
     * - {@link RENDERSTYLE_POINTS}
     *
     * Defaults to {@link RENDERSTYLE_SOLID}.
     *
     * @type {number}
     */
    set renderStyle(renderStyle) {
        this._renderStyle = renderStyle;
        this.mesh.prepareRenderState(renderStyle);
    }

    /**
     * Gets the render style of the mesh instance.
     *
     * @type {number}
     */
    get renderStyle() {
        return this._renderStyle;
    }

    /**
     * Sets the graphics mesh being instanced.
     *
     * @type {Mesh|null}
     */
    set mesh(mesh) {

        if (mesh === this._mesh) {
            return;
        }

        if (this._mesh) {
            this._mesh.decRefCount();
        }

        this._mesh = mesh;

        if (mesh) {
            mesh.incRefCount();
        }
    }

    /**
     * Gets the graphics mesh being instanced.
     *
     * @type {Mesh|null}
     */
    get mesh() {
        return this._mesh;
    }

    /**
     * Sets the world space axis-aligned bounding box for this mesh instance.
     *
     * @type {BoundingBox}
     */
    set aabb(aabb) {
        this._aabb = aabb;
    }

    /**
     * Gets the world space axis-aligned bounding box for this mesh instance.
     *
     * @type {BoundingBox}
     */
    get aabb() {
        // use specified world space aabb
        if (!this._updateAabb) {
            return this._aabb;
        }

        // callback function returning world space aabb
        if (this._updateAabbFunc) {
            return this._updateAabbFunc(this._aabb);
        }

        // use local space override aabb if specified
        let localAabb = this._customAabb;
        let toWorldSpace = !!localAabb;

        // otherwise evaluate local aabb
        if (!localAabb) {

            localAabb = _tmpAabb;

            if (this.skinInstance) {

                // Initialize local bone AABBs if needed
                if (!this.mesh.boneAabb) {
                    const morphTargets = this._morphInstance ? this._morphInstance.morph._targets : null;
                    this.mesh._initBoneAabbs(morphTargets);
                }

                // evaluate local space bounds based on all active bones
                const boneUsed = this.mesh.boneUsed;
                let first = true;

                for (let i = 0; i < this.mesh.boneAabb.length; i++) {
                    if (boneUsed[i]) {

                        // transform bone AABB by bone matrix
                        _tempBoneAabb.setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);

                        // add them up
                        if (first) {
                            first = false;
                            localAabb.center.copy(_tempBoneAabb.center);
                            localAabb.halfExtents.copy(_tempBoneAabb.halfExtents);
                        } else {
                            localAabb.add(_tempBoneAabb);
                        }
                    }
                }

                toWorldSpace = true;

            } else if (this.node._aabbVer !== this._aabbVer || this.mesh._aabbVer !== this._aabbMeshVer) {

                // local space bounding box - either from mesh or empty
                if (this.mesh) {
                    localAabb.center.copy(this.mesh.aabb.center);
                    localAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
                } else {
                    localAabb.center.set(0, 0, 0);
                    localAabb.halfExtents.set(0, 0, 0);
                }

                // update local space bounding box by morph targets
                if (this.mesh && this.mesh.morph) {
                    const morphAabb = this.mesh.morph.aabb;
                    localAabb._expand(morphAabb.getMin(), morphAabb.getMax());
                }

                toWorldSpace = true;
                this._aabbVer = this.node._aabbVer;
                this._aabbMeshVer = this.mesh._aabbVer;
            }
        }

        // store world space bounding box
        if (toWorldSpace) {
            this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
        }

        return this._aabb;
    }

    /**
     * Clear the internal shader cache.
     *
     * @ignore
     */
    clearShaders() {
        this._shaderCache.forEach((shaderInstance) => {
            shaderInstance.destroy();
        });
        this._shaderCache.clear();
    }

    /**
     * Returns the shader instance for the specified shader pass and lights that is compatible
     * with this mesh instance.
     *
     * @param {number} shaderPass - The shader pass index.
     * @param {LightList} lightList - The lights of the pass.
     * @param {Scene} scene - The scene.
     * @param {CameraShaderParams} cameraShaderParams - The camera shader parameters.
     * @param {UniformBufferFormat} [viewUniformFormat] - The format of the view uniform buffer.
     * @returns {ShaderInstance} - the shader instance.
     * @ignore
     */
    getShaderInstance(shaderPass, lightList, scene, cameraShaderParams, viewUniformFormat) {

        const shaderDefs = this._shaderDefs;

        // unique hash for the required shader
        lookupHashes[0] = shaderPass;
        lookupHashes[1] = lightList.hash;
        lookupHashes[2] = shaderDefs;
        lookupHashes[3] = cameraShaderParams.hash;

        // the uv sets the mesh provides decide which of the material's maps the shader samples
        lookupHashes[4] = this.mesh.vertexBuffer?.format.uvMask ?? 0;
        const hash = hash32Fnv1a(lookupHashes);

        // look up the cache
        let shaderInstance = this._shaderCache.get(hash);

        // cache miss in the shader cache of the mesh instance
        if (!shaderInstance) {

            const mat = this._material;

            // get the shader from the material
            shaderInstance = new ShaderInstance();
            shaderInstance.shader = mat.variants.get(hash);
            shaderInstance.hashes = new Uint32Array(lookupHashes);

            // cache miss in the material variants
            if (!shaderInstance.shader) {

                // marker to allow us to see the source node for shader alloc
                DebugGraphics.pushGpuMarker(this.mesh.device, `Node: ${this.node.name}`);

                const shader = mat.getShaderVariant({
                    device: this.mesh.device,
                    scene: scene,
                    objDefs: shaderDefs,
                    cameraShaderParams: cameraShaderParams,
                    pass: shaderPass,
                    lightList: lightList,
                    viewUniformFormat: viewUniformFormat,
                    vertexFormat: this.mesh.vertexBuffer?.format
                });

                DebugGraphics.popGpuMarker(this.mesh.device);

                // add it to the material variants cache
                mat.variants.set(hash, shader);

                shaderInstance.shader = shader;
            }

            // add it to the mesh instance cache
            this._shaderCache.set(hash, shaderInstance);
        }

        Debug.call(() => {
            // due to a small number of shaders in the cache, and to avoid performance hit, we're not
            // handling the hash collision. This is very unlikely but still possible. Check and report
            // if it happens in the debug mode, allowing us to fix the issue.
            if (!array.equals(shaderInstance.hashes, lookupHashes)) {
                Debug.errorOnce('Hash collision in the shader cache for mesh instance. This is very unlikely but still possible. Please report this issue.');
            }
        });

        return shaderInstance;
    }

    /**
     * Sets the material used by this mesh instance.
     *
     * @type {Material|null}
     */
    set material(material) {

        this.clearShaders();

        const prevMat = this._material;

        // Remove the material's reference to this mesh instance
        if (prevMat) {
            prevMat.removeMeshInstanceRef(this);
        }

        this._material = material;

        // which parameters override the material uniform buffer depends on the material
        this._rebuildParameterLists();

        if (material) {

            // Record that the material is referenced by this mesh instance
            material.addMeshInstanceRef(this);

            // update transparent flag based on material
            this.transparent = material.transparent;

            this.updateKey();
        }
    }

    /**
     * Gets the material used by this mesh instance.
     *
     * @type {Material|null}
     */
    get material() {
        return this._material;
    }

    /**
     * @param {number} shaderDefs - The shader definitions to set.
     * @private
     */
    _updateShaderDefs(shaderDefs) {
        if (shaderDefs !== this._shaderDefs) {
            this._shaderDefs = shaderDefs;
            this.clearShaders();
        }
    }

    /**
     * Sets the callback to calculate sort distance. In some circumstances mesh instances are
     * sorted by a distance calculation to determine their rendering order. Set this callback to
     * override the default distance calculation, which gives the dot product of the camera forward
     * vector and the vector between the camera position and the center of the mesh instance's
     * axis-aligned bounding box. This option can be particularly useful for rendering transparent
     * meshes in a better order than the default.
     *
     * @type {CalculateSortDistanceCallback|null}
     */
    set calculateSortDistance(calculateSortDistance) {
        this._calculateSortDistance = calculateSortDistance;
    }

    /**
     * Gets the callback to calculate sort distance.
     *
     * @type {CalculateSortDistanceCallback|null}
     */
    get calculateSortDistance() {
        return this._calculateSortDistance;
    }

    set receiveShadow(val) {
        if (this._receiveShadow !== val) {
            this._receiveShadow = val;
            this._updateShaderDefs(val ? (this._shaderDefs & ~SHADERDEF_NOSHADOW) : (this._shaderDefs | SHADERDEF_NOSHADOW));
        }
    }

    get receiveShadow() {
        return this._receiveShadow;
    }

    set batching(val) {
        this._updateShaderDefs(val ? (this._shaderDefs | SHADERDEF_BATCH) : (this._shaderDefs & ~SHADERDEF_BATCH));
    }

    get batching() {
        return (this._shaderDefs & SHADERDEF_BATCH) !== 0;
    }

    /**
     * Sets the skin instance managing skinning of this mesh instance. Set to null if skinning is
     * not used.
     *
     * @type {SkinInstance|null}
     */
    set skinInstance(val) {
        this._skinInstance = val;
        this._updateShaderDefs(val ? (this._shaderDefs | SHADERDEF_SKIN) : (this._shaderDefs & ~SHADERDEF_SKIN));
        this._setupSkinUpdate();
    }

    /**
     * Gets the skin instance managing skinning of this mesh instance.
     *
     * @type {SkinInstance|null}
     */
    get skinInstance() {
        return this._skinInstance;
    }

    /**
     * Sets the morph instance managing morphing of this mesh instance. Set to null if morphing is
     * not used.
     *
     * @type {MorphInstance|null}
     */
    set morphInstance(val) {

        // release existing
        this._morphInstance?.destroy();

        // assign new
        this._morphInstance = val;

        let shaderDefs = this._shaderDefs;
        shaderDefs = (val && val.morph.morphPositions) ? (shaderDefs | SHADERDEF_MORPH_POSITION) : (shaderDefs & ~SHADERDEF_MORPH_POSITION);
        shaderDefs = (val && val.morph.morphNormals) ? (shaderDefs | SHADERDEF_MORPH_NORMAL) : (shaderDefs & ~SHADERDEF_MORPH_NORMAL);
        shaderDefs = (val && val.morph.intRenderFormat) ? (shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED_INT) : (shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED_INT);
        this._updateShaderDefs(shaderDefs);
    }

    /**
     * Gets the morph instance managing morphing of this mesh instance.
     *
     * @type {MorphInstance|null}
     */
    get morphInstance() {
        return this._morphInstance;
    }

    set screenSpace(val) {
        if (this._screenSpace !== val) {
            this._screenSpace = val;
            this._updateShaderDefs(val ? (this._shaderDefs | SHADERDEF_SCREENSPACE) : (this._shaderDefs & ~SHADERDEF_SCREENSPACE));
        }
    }

    get screenSpace() {
        return this._screenSpace;
    }

    set key(val) {
        this._sortKeyForward = val;
    }

    get key() {
        return this._sortKeyForward;
    }

    /**
     * Sets the light mask of this mesh instance: which {@link LightComponent}s light it. The value
     * is a combination of `MASK_AFFECT_DYNAMIC`, `MASK_AFFECT_LIGHTMAPPED` and `MASK_BAKE`.
     * Defaults to `MASK_AFFECT_DYNAMIC`.
     *
     * @type {number}
     */
    set mask(val) {
        const toggles = this._shaderDefs & 0x0000FFFF;
        this._updateShaderDefs(toggles | (val << 16));
    }

    /**
     * Gets the light mask of this mesh instance: which {@link LightComponent}s light it.
     *
     * @type {number}
     */
    get mask() {
        return this._shaderDefs >> 16;
    }

    /**
     * Sets the number of instances when using hardware instancing to render the mesh.
     *
     * @type {number}
     */
    set instancingCount(value) {
        if (this.instancingData) {
            this.instancingData.count = value;
        }
    }

    /**
     * Gets the number of instances when using hardware instancing to render the mesh.
     *
     * @type {number}
     */
    get instancingCount() {
        return this.instancingData ? this.instancingData.count : 0;
    }

    destroy() {

        const mesh = this.mesh;
        if (mesh) {

            // this decreases ref count on the mesh
            this.mesh = null;

            // destroy mesh
            if (mesh.refCount < 1) {
                mesh.destroy();
            }
        }

        // release ref counted lightmaps
        this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
        this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);

        this._skinInstance?.destroy();
        this._skinInstance = null;

        this.morphInstance?.destroy();
        this.morphInstance = null;

        this.clearShaders();

        this._destroyMaterialUniformBuffer();

        // make sure material clears references to this meshInstance
        this.material = null;

        this.instancingData?.destroy();

        this.destroyDrawCommands();
    }

    destroyDrawCommands() {
        if (this.drawCommands) {
            for (const cmd of this.drawCommands.values()) {
                cmd?.destroy();
            }
            this.drawCommands = null;
        }
    }

    // shader uniform names for the lightmaps of a mesh instance
    static lightmapParamNames = instanceLightmapUniformNames;

    /**
     * Sets the render style for an array of mesh instances.
     *
     * @param {MeshInstance[]} meshInstances - The mesh instances to set the render style for.
     * @param {number} renderStyle - The render style to set.
     * @ignore
     */
    static _prepareRenderStyleForArray(meshInstances, renderStyle) {

        if (meshInstances) {
            for (let i = 0; i < meshInstances.length; i++) {

                // switch mesh instance to the requested style
                meshInstances[i]._renderStyle = renderStyle;

                // process all unique meshes
                const mesh = meshInstances[i].mesh;
                if (!_meshSet.has(mesh)) {
                    _meshSet.add(mesh);
                    mesh.prepareRenderState(renderStyle);
                }
            }

            _meshSet.clear();
        }
    }

    /**
     * Test if meshInstance is visible by camera. It requires the frustum of the camera to be up to
     * date, which forward-renderer takes care of. This function should not be called elsewhere.
     *
     * @param {Camera} camera - The camera to test visibility against.
     * @returns {boolean} - True if the mesh instance is visible by the camera, false otherwise.
     * @ignore
     */
    _isVisible(camera) {

        if (this.visible) {

            // custom visibility method of MeshInstance
            if (this.isVisibleFunc) {
                return this.isVisibleFunc(camera);
            }

            // note that reading aabb evaluates it
            return camera.frustum.containsAabb(this.aabb);
        }

        return false;
    }

    updateKey() {

        // 31      : sign bit (leave as 0)
        // 30 - 23 : 8 bits for draw bucket - highest priority for sorting
        // 22      : 1 bit for alpha test / coverage, to render them after opaque for GPU efficiency
        // 21 - 0  : 22 bits for material ID
        const { material } = this;
        this._sortKeyForward =
            (this._drawBucket << 23) |
            ((material.alphaToCoverage || material.alphaTest) ? 0x400000 : 0) |
            (material.id & 0x3fffff);
    }

    /**
     * Sets up {@link MeshInstance} to be rendered using Hardware Instancing.
     * Note that {@link instancingCount} is automatically set to the number of vertices of the
     * vertex buffer when it is provided.
     *
     * @param {VertexBuffer|true|null} vertexBuffer - Vertex buffer to hold per-instance vertex data
     * (usually world matrices). Pass `true` to enable attributeless instancing where the instance
     * index is derived from `gl_InstanceID` / `instance_index` builtins rather than a vertex
     * buffer attribute — the caller must set {@link instancingCount} manually. Pass null to turn
     * off hardware instancing.
     * @param {boolean} cull - Whether to perform frustum culling on this instance. If true, the whole
     * instance will be culled by the camera frustum. This often involves setting
     * {@link RenderComponent#customAabb} containing all instances. Defaults to false, which means
     * the whole instance is always rendered.
     */
    setInstancing(vertexBuffer, cull = false) {
        if (vertexBuffer) {
            if (vertexBuffer === true) {
                this.instancingData = new InstancingData(0);
            } else {
                this.instancingData = new InstancingData(vertexBuffer.numVertices);
                this.instancingData.vertexBuffer = vertexBuffer;

                // mark vertex buffer as instancing data
                vertexBuffer.format.instancing = true;
            }

            // set up culling
            this.cull = cull;
        } else {
            this.instancingData = null;
            this.cull = true;
        }

        this._updateShaderDefs(vertexBuffer instanceof VertexBuffer ?
            (this._shaderDefs | SHADERDEF_INSTANCING) :
            (this._shaderDefs & ~SHADERDEF_INSTANCING));
    }

    /**
     * Sets the {@link MeshInstance} to be rendered using indirect rendering, where the GPU,
     * typically using a Compute shader, stores draw call parameters in a buffer.
     * Note that this is only supported on WebGPU (see
     * {@link GraphicsDevice#supportsIndirectDraw}), and ignored on other platforms, where the
     * mesh instance renders as a normal draw call.
     *
     * @param {CameraComponent|null} camera - Camera component to set indirect data for, or
     * null if the indirect slot should be used for all cameras.
     * @param {number} slot - Slot in the buffer to set the draw call parameters. Allocate a slot
     * in the buffer by calling {@link GraphicsDevice#getIndirectDrawSlot}. Pass -1 to disable
     * indirect rendering for the specified camera (or the shared entry when camera is null).
     * @param {number} [count] - Optional number of consecutive slots to use. Defaults to 1.
     */
    setIndirect(camera, slot, count = 1) {
        const key = camera?.camera.id ?? null;

        // disable when slot is -1
        if (slot === -1) {
            this._deleteDrawCommandsKey(key);
        } else if (this.mesh.device.supportsIndirectDraw) {
            const cmd = this._allocDrawCommands(key, false);
            cmd.slotIndex = slot;
            cmd.update(count);

            // the slot is recycled at the end of the frame, so the commands only apply to this
            // frame - they need to be assigned again for the next one
            cmd.validUntilVersion = this.mesh.device.drawCommandsVersion;
        } else {
            // ignored as documented - the backend cannot source draw parameters from a buffer, and
            // draw commands it has no way to execute would take it down its multi-draw path
            Debug.warnOnce('MeshInstance#setIndirect: indirect rendering is only supported on WebGPU, ignoring the call.');
        }
    }

    /**
     * Sets the {@link MeshInstance} to be rendered using multi-draw, where multiple sub-draws are
     * executed with a single draw call.
     *
     * Note: Each call to this method invalidates any previously stored draw command data for the
     * specified camera.
     *
     * @param {CameraComponent|null} camera - Camera component to bind commands to, or null to share
     * across all cameras.
     * @param {number} [maxCount] - Maximum number of sub-draws to allocate. Defaults to 1. Pass 0
     * to disable multi-draw for the specified camera (or the shared entry when camera is null).
     * @returns {DrawCommands|undefined} The commands container to populate with sub-draw commands.
     */
    setMultiDraw(camera, maxCount = 1) {
        const key = camera?.camera.id ?? null;
        let cmd;

        // disable when maxCount is 0
        if (maxCount === 0) {
            this._deleteDrawCommandsKey(key);
        } else {
            cmd = this._allocDrawCommands(key, true);
            cmd.allocate(maxCount);
        }
        return cmd;
    }

    /**
     * Returns the cached draw commands for a key, allocating them when missing. A cached set of
     * the other kind is released first - indirect and multi-draw commands draw from different
     * backing storage, so they cannot share an instance.
     *
     * @param {number|null} key - The {@link Camera#id} the commands are bound to, or null for the
     * set shared by all cameras.
     * @param {boolean} multiDraw - True for multi-draw commands, false for indirect ones.
     * @returns {DrawCommands} The draw commands to populate.
     * @private
     */
    _allocDrawCommands(key, multiDraw) {

        // lazy map allocation
        const cmds = this.drawCommands ??= new Map();

        let cmd = cmds.get(key);
        if (cmd && cmd.multiDraw !== multiDraw) {
            cmd.destroy();
            cmd = undefined;
        }

        if (!cmd) {
            // multi-draw on WebGL needs the index size of the current mesh index buffer
            let indexSizeBytes = 0;
            if (multiDraw) {
                const indexFormat = this.mesh.indexBuffer?.[0]?.format;
                indexSizeBytes = (indexFormat !== undefined) ? indexFormatByteSize[indexFormat] : 0;
            }
            cmd = new DrawCommands(this.mesh.device, indexSizeBytes);
            cmd.multiDraw = multiDraw;
            cmds.set(key, cmd);
        }

        return cmd;
    }

    _deleteDrawCommandsKey(key) {
        const cmds = this.drawCommands;
        if (cmds) {
            const cmd = cmds.get(key);
            cmd?.destroy();
            cmds.delete(key);
            if (cmds.size === 0) {
                this.destroyDrawCommands();
            }
        }
    }

    /**
     * Retrieves the draw commands for a specific camera, or the default commands when none are
     * bound to that camera.
     *
     * @param {Camera} camera - The camera to retrieve commands for.
     * @returns {DrawCommands|undefined} - The draw commands, or undefined.
     * @ignore
     */
    getDrawCommands(camera) {
        const cmds = this.drawCommands;
        if (!cmds) return undefined;

        // commands are cached for reuse, so expired ones are still in the map
        const version = this.mesh.device.drawCommandsVersion;
        const cmd = cmds.get(camera?.id);
        if (cmd && version <= cmd.validUntilVersion) return cmd;
        const shared = cmds.get(null);
        return (shared && version <= shared.validUntilVersion) ? shared : undefined;
    }

    /**
     * Retrieves the mesh metadata needed for indirect rendering.
     *
     * @returns {Int32Array} - A typed array with 4 elements representing the mesh metadata, which
     * is typically needed when generating indirect draw call parameters using Compute shader. These
     * can be provided to the Compute shader using vec4i uniform. The values are based on
     * {@link Mesh#primitive}, stored in this order: [count, base, baseVertex, 0]. The last value is
     * always zero and is reserved for future use.
     */
    getIndirectMetaData() {
        const prim = this.mesh?.primitive[this.renderStyle];
        const data = this.meshMetaData ?? (this.meshMetaData = new Int32Array(4));
        data[0] = prim.count;
        data[1] = prim.base;
        data[2] = prim.baseVertex;
        // data[3] is padding, can be used for first instance in the future
        return data;
    }

    ensureMaterial(device) {
        if (!this.material) {
            Debug.warn(`Mesh attached to entity '${this.node.name}' does not have a material, using a default one.`);
            this.material = getDefaultMaterial(device);
        }
    }

    // Parameter management
    clearParameters() {
        this.parameters.clear();
        this._scopeParameters.length = 0;
        this._materialOverrides.length = 0;
        this._materialTextureOverrides.length = 0;
        this._materialOverridesVersion++;
    }

    getParameters() {
        return this.parameters;
    }

    /**
     * Retrieves the specified shader parameter from a mesh instance.
     *
     * @param {string} name - The name of the parameter to query.
     * @returns {object|undefined} The named parameter, or `undefined` if no parameter with that
     * name is set on this mesh instance.
     */
    getParameter(name) {
        return this.parameters.get(name);
    }

    /**
     * Sets a shader parameter on a mesh instance. Note that this parameter will take precedence
     * over parameter of the same name if set on Material this mesh instance uses for rendering.
     * To change an array value, call this method again with it; the contents of an array are not
     * guaranteed to be re-read on later draws.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|Texture|Float32Array} data - The value for the specified parameter.
     */
    setParameter(name, data) {

        Debug.call(() => {
            if (arguments[2] !== undefined) {
                Debug.removed('MeshInstance#setParameter: the "passFlags" argument has been removed and is ignored.');
            }
            if (this._material?._usesViewTextures && isViewTexture(name)) {
                Debug.warnOnce(`MeshInstance#setParameter: '${name}' is a texture the renderer supplies once per pass, and a value set per mesh instance is ignored on WebGPU.`, this);
            }
        });

        const param = this.parameters.get(name);
        if (param) {
            param.data = data;

            // a new value for an override of the material uniform buffer
            if (param.override) {
                this._materialOverridesVersion++;
            }
        } else {
            const parameter = {
                name: name,
                data: data,
                scopeId: null,
                override: false,
                uniformFormat: null,
                textureSlot: -1
            };
            this.parameters.set(name, parameter);
            this._addParameter(parameter);
        }
    }

    /**
     * A wrapper over settings parameter specifically for realtime baked lightmaps. This handles
     * reference counting of lightmaps and releases them when no longer referenced.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {Texture|null} texture - The lightmap texture to set.
     * @ignore
     */
    setRealtimeLightmap(name, texture) {
        // no change
        const old = this.getParameter(name);
        if (old === texture) {
            return;
        }

        // remove old
        if (old) {
            LightmapCache.decRef(old.data);
        }

        // assign new
        if (texture) {
            LightmapCache.incRef(texture);
            this.setParameter(name, texture);
        } else {
            this.deleteParameter(name);
        }
    }

    /**
     * Deletes a shader parameter on a mesh instance.
     *
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        const parameter = this.parameters.get(name);
        if (parameter) {
            this.parameters.delete(name);
            const list = parameter.override ? this._materialOverrides :
                (parameter.textureSlot >= 0 ? this._materialTextureOverrides : this._scopeParameters);
            list.splice(list.indexOf(parameter), 1);
            if (parameter.override) {
                this._materialOverridesVersion++;
            }
        }
    }

    /**
     * Used to apply parameters from this mesh instance into scope of uniforms, called internally
     * by forward-renderer. Parameters overriding uniforms of the material uniform buffer are not
     * part of this, they are applied by {@link MeshInstance#getMaterialBindGroup}.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @ignore
     */
    setParameters(device) {
        const parameters = this._scopeParameters;
        for (let i = 0; i < parameters.length; i++) {
            const parameter = parameters[i];
            if (!parameter.scopeId) {
                parameter.scopeId = device.scope.resolve(parameter.name);
            }
            parameter.scopeId.setValue(parameter.data);
        }
    }

    /**
     * Adds a parameter to the scope list, or to the overrides of the material uniform buffer when
     * its name is the uniform of a typed property of the material.
     *
     * @param {MeshInstanceParameter} parameter - The parameter.
     * @private
     */
    _addParameter(parameter) {
        const material = this._material;
        parameter.override = !!material?.getUniformBufferProperty(parameter.name);
        parameter.uniformFormat = null;

        // a name which is not a uniform of the material buffer can still be one of its textures
        parameter.textureSlot = parameter.override ? -1 : (material?.getTextureSlot(parameter.name) ?? -1);

        if (parameter.override) {
            this._materialOverrides.push(parameter);
            this._materialOverridesVersion++;
        } else if (parameter.textureSlot >= 0) {

            // the copy of the bind group assigns the overriding textures on every draw, so there
            // is no version for them to move
            this._materialTextureOverrides.push(parameter);
        } else {
            this._scopeParameters.push(parameter);
        }
    }

    /**
     * Splits the parameters between the scope and the material uniform buffer again, after the
     * material or its set of typed properties changed.
     *
     * @private
     */
    _rebuildParameterLists() {
        this._scopeParameters.length = 0;
        this._materialOverrides.length = 0;
        this._materialTextureOverrides.length = 0;
        for (const parameter of this.parameters.values()) {
            this._addParameter(parameter);
        }
        this._materialLayoutVersion = this._material?.layoutVersion ?? -1;
        this._materialOverridesVersion++;
    }

    /**
     * Returns the bind group to use at the material bind group index for this mesh instance: a
     * per-instance copy of the material's bind group with the overriding parameters applied, or
     * null when no parameter overrides anything in it, in which case the material's own bind group
     * is used. The copy of the uniform buffer is synchronized when the material data or the
     * overrides changed; the textures are assigned every time, as they are only references.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {BindGroup|null} The bind group of the overriding copy, or null.
     * @ignore
     */
    getMaterialBindGroup(device) {
        const material = this._material;

        // the set of typed properties of the material changed - split the parameters again
        if (this._materialLayoutVersion !== material.layoutVersion) {
            this._rebuildParameterLists();
        }

        const overrides = this._materialOverrides;
        const textureOverrides = this._materialTextureOverrides;
        const materialUniformBuffer = material.uniformBuffer;
        if ((overrides.length === 0 && textureOverrides.length === 0) || !materialUniformBuffer) {
            return null;
        }

        // the copy follows the layout of the material - both the format of its buffer and the
        // format of its bind group, which can differ in its textures alone
        const format = materialUniformBuffer.format;
        const bindGroupFormat = material.uniformBufferBindGroup.format;
        let uniformBuffer = this._materialUniformBuffer;
        if (!uniformBuffer || uniformBuffer.format !== format || this._materialBindGroup.format !== bindGroupFormat) {
            this._destroyMaterialUniformBuffer();
            uniformBuffer = new UniformBuffer(device, format, true);
            this._materialUniformBuffer = uniformBuffer;
            this._materialBindGroup = new BindGroup(device, bindGroupFormat, uniformBuffer);
            this._syncedMaterialDataVersion = -1;

            // the uniform formats of the overrides belong to the previous layout
            for (let i = 0; i < overrides.length; i++) {
                overrides[i].uniformFormat = null;
            }
        }

        Debug.assert(uniformBuffer.device === device, 'A mesh instance can only be rendered by the graphics device that created its material uniform buffer copy.', this);

        Debug.call(() => {
            // an override array changed in place is not applied until the next setParameter. When no
            // setParameter moved the override version since the last synchronization, warn about such
            // a change, and check nothing until a setParameter moves the version
            if (this._syncedOverridesVersion === this._materialOverridesVersion &&
                this._debugWarnedOverridesVersion !== this._materialOverridesVersion) {
                const names = getMutatedOverrides(this, overrides);
                if (names.length > 0) {
                    this._debugWarnedOverridesVersion = this._materialOverridesVersion;
                    warnMutatedOverrides(this, names);
                }
            }
        });

        if (this._syncedMaterialDataVersion !== material.uniformDataVersion || this._syncedOverridesVersion !== this._materialOverridesVersion) {
            // the material values, with the overrides applied on top
            uniformBuffer.storageFloat32.set(materialUniformBuffer.storageFloat32);
            for (let i = 0; i < overrides.length; i++) {
                const override = overrides[i];
                override.uniformFormat ??= format.get(override.name);
                Debug.assert(override.uniformFormat, `Uniform '${override.name}' is not part of the material uniform buffer.`, this);
                uniformBuffer.setUniform(override.uniformFormat, override.data);
            }
            Debug.call(() => recordAppliedOverrides(this, overrides));
            uniformBuffer.upload();
            this._syncedMaterialDataVersion = material.uniformDataVersion;
            this._syncedOverridesVersion = this._materialOverridesVersion;
        }

        // the textures of the material, with the overriding ones on top. Assigning a texture is
        // comparing a reference, so there is nothing to gain from tracking a version for it, and
        // the bind group is only rebuilt when one of them actually changed
        const bindGroup = this._materialBindGroup;
        const materialTextures = material.uniformBufferBindGroup.textures;
        for (let i = 0; i < materialTextures.length; i++) {
            const texture = materialTextures[i];
            if (texture) {
                bindGroup.setTextureAt(i, texture);
            }
        }

        for (let i = 0; i < textureOverrides.length; i++) {
            const override = textureOverrides[i];
            bindGroup.setTextureAt(override.textureSlot, override.data);
        }

        // (re)built when dirty: on creation, which needs the uploaded buffer, and after a lost
        // context. Its resources are assigned here, not taken from the scope
        bindGroup.commit();
        return bindGroup;
    }

    /**
     * Releases the per-instance copy of the material uniform buffer.
     *
     * @private
     */
    _destroyMaterialUniformBuffer() {
        this._materialBindGroup?.destroy();
        this._materialBindGroup = null;
        this._materialUniformBuffer?.destroy();
        this._materialUniformBuffer = null;
    }

    /**
     * @param {boolean} value - True to enable lightmapped rendering, false to disable.
     * @ignore
     */
    setLightmapped(value) {
        if (value) {
            this.mask = (this.mask | MASK_AFFECT_LIGHTMAPPED) & ~(MASK_AFFECT_DYNAMIC | MASK_BAKE);
        } else {
            this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
            this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
            this._shaderDefs &= ~(SHADERDEF_LM | SHADERDEF_DIRLM | SHADERDEF_LMAMBIENT);
            this.mask = (this.mask | MASK_AFFECT_DYNAMIC) & ~(MASK_AFFECT_LIGHTMAPPED | MASK_BAKE);
        }
    }

    /**
     * @param {BoundingBox|null} aabb - The custom axis-aligned bounding box or null to reset to
     * the mesh's bounding box.
     * @ignore
     */
    setCustomAabb(aabb) {
        if (aabb) {
            // store the override aabb
            if (this._customAabb) {
                this._customAabb.copy(aabb);
            } else {
                this._customAabb = aabb.clone();
            }
        } else {
            // no override, force refresh the actual one
            this._customAabb = null;
            this._aabbVer = -1;
        }

        this._setupSkinUpdate();
    }

    /** @private */
    _setupSkinUpdate() {
        // set if bones need to be updated before culling
        if (this._skinInstance) {
            this._skinInstance._updateBeforeCull = !this._customAabb;
        }
    }
}

export { MeshInstance };
