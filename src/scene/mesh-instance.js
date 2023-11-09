import { Debug, DebugHelper } from '../core/debug.js';

import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';

import { BindGroup } from '../platform/graphics/bind-group.js';
import { UniformBuffer } from '../platform/graphics/uniform-buffer.js';

import {
    BLEND_NONE, BLEND_NORMAL,
    LAYER_WORLD,
    MASK_AFFECT_DYNAMIC, MASK_BAKE, MASK_AFFECT_LIGHTMAPPED,
    RENDERSTYLE_SOLID,
    SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, SHADERDEF_NOSHADOW, SHADERDEF_SKIN,
    SHADERDEF_SCREENSPACE, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED,
    SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, SHADERDEF_INSTANCING,
    SORTKEY_FORWARD
} from './constants.js';

import { GraphNode } from './graph-node.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { LightmapCache } from './graphics/lightmap-cache.js';

let id = 0;
const _tmpAabb = new BoundingBox();
const _tempBoneAabb = new BoundingBox();
const _tempSphere = new BoundingSphere();
const _meshSet = new Set();

/**
 * Internal data structure used to store data used by hardware instancing.
 *
 * @ignore
 */
class InstancingData {
    /** @type {import('../platform/graphics/vertex-buffer.js').VertexBuffer|null} */
    vertexBuffer = null;

    /**
     * @param {number} numObjects - The number of objects instanced.
     */
    constructor(numObjects) {
        this.count = numObjects;
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
     * @type {import('../platform/graphics/shader.js').Shader|undefined}
     */
    shader;

    /**
     * A bind group storing mesh uniforms for the shader.
     *
     * @type {BindGroup|null}
     */
    bindGroup = null;

    /**
     * Returns the mesh bind group for the shader.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @returns {BindGroup} - The mesh bind group.
     */
    getBindGroup(device) {

        // create bind group
        if (!this.bindGroup) {
            const shader = this.shader;
            Debug.assert(shader);

            // mesh uniform buffer
            const ubFormat = shader.meshUniformBufferFormat;
            Debug.assert(ubFormat);
            const uniformBuffer = new UniformBuffer(device, ubFormat, false);

            // mesh bind group
            const bindGroupFormat = shader.meshBindGroupFormat;
            Debug.assert(bindGroupFormat);
            this.bindGroup = new BindGroup(device, bindGroupFormat, uniformBuffer);
            DebugHelper.setName(this.bindGroup, `MeshBindGroup_${this.bindGroup.id}`);
        }

        return this.bindGroup;
    }

    destroy() {
        const group = this.bindGroup;
        if (group) {
            group.defaultUniformBuffer?.destroy();
            group.destroy();
            this.bindGroup = null;
        }
    }
}

/**
 * An entry in the shader cache, representing shaders for this mesh instance and a specific shader
 * pass.
 *
 * @ignore
 */
class ShaderCacheEntry {
    /**
     * The shader instances. Looked up by lightHash, which represents an ordered set of lights.
     *
     * @type {Map<number, ShaderInstance>}
     */
    shaderInstances = new Map();

    destroy() {
        this.shaderInstances.forEach(instance => instance.destroy());
        this.shaderInstances.clear();
    }
}

/**
 * Callback used by {@link Layer} to calculate the "sort distance" for a {@link MeshInstance},
 * which determines its place in the render order.
 *
 * @callback CalculateSortDistanceCallback
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {import('../core/math/vec3.js').Vec3} cameraPosition - The position of the camera.
 * @param {import('../core/math/vec3.js').Vec3} cameraForward - The forward vector of the camera.
 */

/**
 * An instance of a {@link Mesh}. A single mesh can be referenced by many mesh instances that can
 * have different transforms and materials.
 *
 * @category Graphics
 */
class MeshInstance {
    /**
     * Enable rendering for this mesh instance. Use visible property to enable/disable
     * rendering without overhead of removing from scene. But note that the mesh instance is
     * still in the hierarchy and still in the draw call list.
     *
     * @type {boolean}
     */
    visible = true;

    /**
     * Enable shadow casting for this mesh instance. Use this property to enable/disable
     * shadow casting without overhead of removing from scene. Note that this property does not
     * add the mesh instance to appropriate list of shadow casters on a {@link Layer}, but
     * allows mesh to be skipped from shadow casting while it is in the list already. Defaults to
     * false.
     *
     * @type {boolean}
     */
    castShadow = false;

    /**
     * True if the material of the mesh instance is transparent. Optimization to avoid accessing the
     * material. Updated by the material instance itself.
     *
     * @ignore
     */
    transparent = false;

    /**
     * @type {import('./materials/material.js').Material|null}
     * @private
     */
    _material = null;

    /**
     * An array of shader cache entries, indexed by the shader pass constant (SHADER_FORWARD..). The
     * value stores all shaders and bind groups for the shader pass for various light combinations.
     *
     * @type {Array<ShaderCacheEntry|null>}
     * @private
     */
    _shaderCache = [];

    /** @ignore */
    id = id++;

    /**
     * True if the mesh instance is pickable by the {@link Picker}. Defaults to true.
     *
     * @type {boolean}
     * @ignore
     */
    pick = true;

    /**
     * Create a new MeshInstance instance.
     *
     * @param {import('./mesh.js').Mesh} mesh - The graphics mesh to instance.
     * @param {import('./materials/material.js').Material} material - The material to use for this
     * mesh instance.
     * @param {GraphNode} [node] - The graph node defining the transform for this instance. This
     * parameter is optional when used with {@link RenderComponent} and will use the node the
     * component is attached to.
     * @example
     * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
     * const mesh = pc.createBox(graphicsDevice);
     * const material = new pc.StandardMaterial();
     *
     * const meshInstance = new pc.MeshInstance(mesh, material);
     *
     * const entity = new pc.Entity();
     * entity.addComponent('render', {
     *     meshInstances: [meshInstance]
     * });
     *
     * // Add the entity to the scene hierarchy
     * this.app.scene.root.addChild(entity);
     */
    constructor(mesh, material, node = null) {
        // if first parameter is of GraphNode type, handle previous constructor signature: (node, mesh, material)
        if (mesh instanceof GraphNode) {
            const temp = mesh;
            mesh = material;
            material = node;
            node = temp;
        }

        this._key = [0, 0];

        /**
         * The graph node defining the transform for this instance.
         *
         * @type {GraphNode}
         */
        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;          // The mesh that this instance renders
        mesh.incRefCount();
        this.material = material;   // The material with which to render this instance

        this._shaderDefs = MASK_AFFECT_DYNAMIC << 16; // 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = pc.MASK_AFFECT_DYNAMIC
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? SHADERDEF_UV0 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? SHADERDEF_UV1 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? SHADERDEF_VCOLOR : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasTangents ? SHADERDEF_TANGENTS : 0;

        // Render options
        this.layer = LAYER_WORLD; // legacy
        /** @private */
        this._renderStyle = RENDERSTYLE_SOLID;
        this._receiveShadow = true;
        this._screenSpace = false;
        this._noDepthDrawGl1 = false;

        /**
         * Controls whether the mesh instance can be culled by frustum culling
         * ({@link CameraComponent#frustumCulling}). Defaults to true.
         *
         * @type {boolean}
         */
        this.cull = true;

        this._updateAabb = true;
        this._updateAabbFunc = null;
        this._calculateSortDistance = null;

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();

        /**
         * @type {import('./skin-instance.js').SkinInstance|null}
         * @private
         */
        this._skinInstance = null;

        /**
         * @type {import('./morph-instance.js').MorphInstance|null}
         * @private
         */
        this._morphInstance = null;

        this.instancingData = null;

        /**
         * @type {BoundingBox|null}
         * @private
         */
        this._customAabb = null;

        // World space AABB
        this.aabb = new BoundingBox();
        this._aabbVer = -1;
        this._aabbMeshVer = -1;

        /**
         * Use this value to affect rendering order of mesh instances. Only used when mesh
         * instances are added to a {@link Layer} with {@link Layer#opaqueSortMode} or
         * {@link Layer#transparentSortMode} (depending on the material) set to
         * {@link SORTMODE_MANUAL}.
         *
         * @type {number}
         */
        this.drawOrder = 0;

        /**
         * Read this value in {@link Layer#onPostCull} to determine if the object is actually going
         * to be rendered.
         *
         * @type {boolean}
         */
        this.visibleThisFrame = false;

        // custom function used to customize culling (e.g. for 2D UI elements)
        this.isVisibleFunc = null;

        this.parameters = {};

        this.stencilFront = null;
        this.stencilBack = null;

        // Negative scale batching support
        this.flipFacesFactor = 1;
    }

    /**
     * The render style of the mesh instance. Can be:
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

    get renderStyle() {
        return this._renderStyle;
    }

    /**
     * The graphics mesh being instanced.
     *
     * @type {import('./mesh.js').Mesh}
     */
    set mesh(mesh) {

        if (mesh === this._mesh)
            return;

        if (this._mesh) {
            this._mesh.decRefCount();
        }

        this._mesh = mesh;

        if (mesh) {
            mesh.incRefCount();
        }
    }

    get mesh() {
        return this._mesh;
    }

    /**
     * The world space axis-aligned bounding box for this mesh instance.
     *
     * @type {BoundingBox}
     */
    set aabb(aabb) {
        this._aabb = aabb;
    }

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
        const shaderCache = this._shaderCache;
        for (let i = 0; i < shaderCache.length; i++) {
            shaderCache[i]?.destroy();
            shaderCache[i] = null;
        }
    }

    /**
     * Returns the shader instance for the specified shader pass and light hash that is compatible
     * with this mesh instance.
     *
     * @param {number} shaderPass - The shader pass index.
     * @param {number} lightHash - The hash value of the lights that are affecting this mesh instance.
     * @param {import('./scene.js').Scene} scene - The scene.
     * @param {import('../platform/graphics/uniform-buffer-format.js').UniformBufferFormat} [viewUniformFormat] - The
     * format of the view uniform buffer.
     * @param {import('../platform/graphics/bind-group-format.js').BindGroupFormat} [viewBindGroupFormat] - The
     * format of the view bind group.
     * @param {any} [sortedLights] - Array of arrays of lights.
     * @returns {ShaderInstance} - the shader instance.
     * @ignore
     */
    getShaderInstance(shaderPass, lightHash, scene, viewUniformFormat, viewBindGroupFormat, sortedLights) {

        let shaderInstance;
        let passEntry = this._shaderCache[shaderPass];
        if (passEntry) {
            shaderInstance = passEntry.shaderInstances.get(lightHash);
        } else {
            passEntry = new ShaderCacheEntry();
            this._shaderCache[shaderPass] = passEntry;
        }

        // cache miss in the shader cache of the mesh instance
        if (!shaderInstance) {

            // get the shader from the material
            const mat = this._material;
            const shaderDefs = this._shaderDefs;
            const variantKey = shaderPass + '_' + shaderDefs + '_' + lightHash;
            shaderInstance = new ShaderInstance();
            shaderInstance.shader = mat.variants.get(variantKey);

            // cache miss in the material variants
            if (!shaderInstance.shader) {

                const shader = mat.getShaderVariant(this.mesh.device, scene, shaderDefs, null, shaderPass, sortedLights,
                                                    viewUniformFormat, viewBindGroupFormat, this._mesh.vertexBuffer.format);

                // add it to the material variants cache
                mat.variants.set(variantKey, shader);

                shaderInstance.shader = shader;
            }

            // add it to the mesh instance cache
            passEntry.shaderInstances.set(lightHash, shaderInstance);
        }

        return shaderInstance;
    }

    /**
     * The material used by this mesh instance.
     *
     * @type {import('./materials/material.js').Material}
     */
    set material(material) {

        this.clearShaders();

        const prevMat = this._material;

        // Remove the material's reference to this mesh instance
        if (prevMat) {
            prevMat.removeMeshInstanceRef(this);
        }

        this._material = material;

        if (material) {

            // Record that the material is referenced by this mesh instance
            material.addMeshInstanceRef(this);

            // update transparent flag based on material
            this.transparent = material.transparent;

            this.updateKey();
        }
    }

    get material() {
        return this._material;
    }

    set layer(layer) {
        this._layer = layer;
        this.updateKey();
    }

    get layer() {
        return this._layer;
    }

    _updateShaderDefs(shaderDefs) {
        if (shaderDefs !== this._shaderDefs) {
            this._shaderDefs = shaderDefs;
            this.clearShaders();
        }
    }

    /**
     * In some circumstances mesh instances are sorted by a distance calculation to determine their
     * rendering order. Set this callback to override the default distance calculation, which gives
     * the dot product of the camera forward vector and the vector between the camera position and
     * the center of the mesh instance's axis-aligned bounding box. This option can be particularly
     * useful for rendering transparent meshes in a better order than default.
     *
     * @type {CalculateSortDistanceCallback}
     */
    set calculateSortDistance(calculateSortDistance) {
        this._calculateSortDistance = calculateSortDistance;
    }

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

    /**
     * The skin instance managing skinning of this mesh instance, or null if skinning is not used.
     *
     * @type {import('./skin-instance.js').SkinInstance}
     */
    set skinInstance(val) {
        this._skinInstance = val;
        this._updateShaderDefs(val ? (this._shaderDefs | SHADERDEF_SKIN) : (this._shaderDefs & ~SHADERDEF_SKIN));
        this._setupSkinUpdate();
    }

    get skinInstance() {
        return this._skinInstance;
    }

    /**
     * The morph instance managing morphing of this mesh instance, or null if morphing is not used.
     *
     * @type {import('./morph-instance.js').MorphInstance}
     */
    set morphInstance(val) {

        // release existing
        this._morphInstance?.destroy();

        // assign new
        this._morphInstance = val;

        let shaderDefs = this._shaderDefs;
        shaderDefs = (val && val.morph.useTextureMorph) ? (shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED) : (shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED);
        shaderDefs = (val && val.morph.morphPositions) ? (shaderDefs | SHADERDEF_MORPH_POSITION) : (shaderDefs & ~SHADERDEF_MORPH_POSITION);
        shaderDefs = (val && val.morph.morphNormals) ? (shaderDefs | SHADERDEF_MORPH_NORMAL) : (shaderDefs & ~SHADERDEF_MORPH_NORMAL);
        this._updateShaderDefs(shaderDefs);
    }

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
        this._key[SORTKEY_FORWARD] = val;
    }

    get key() {
        return this._key[SORTKEY_FORWARD];
    }

    /**
     * Mask controlling which {@link LightComponent}s light this mesh instance, which
     * {@link CameraComponent} sees it and in which {@link Layer} it is rendered. Defaults to 1.
     *
     * @type {number}
     */
    set mask(val) {
        const toggles = this._shaderDefs & 0x0000FFFF;
        this._updateShaderDefs(toggles | (val << 16));
    }

    get mask() {
        return this._shaderDefs >> 16;
    }

    /**
     * Number of instances when using hardware instancing to render the mesh.
     *
     * @type {number}
     */
    set instancingCount(value) {
        if (this.instancingData)
            this.instancingData.count = value;
    }

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

        // make sure material clears references to this meshInstance
        this.material = null;
    }

    // shader uniform names for lightmaps
    static lightmapParamNames = ['texture_lightMap', 'texture_dirLightMap'];

    // generates wireframes for an array of mesh instances
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

    // test if meshInstance is visible by camera. It requires the frustum of the camera to be up to date, which forward-renderer
    // takes care of. This function should  not be called elsewhere.
    _isVisible(camera) {

        if (this.visible) {

            // custom visibility method of MeshInstance
            if (this.isVisibleFunc) {
                return this.isVisibleFunc(camera);
            }

            _tempSphere.center = this.aabb.center;  // this line evaluates aabb
            _tempSphere.radius = this._aabb.halfExtents.length();

            return camera.frustum.containsSphere(_tempSphere);
        }

        return false;
    }

    updateKey() {

        // render alphatest/atoc after opaque
        const material = this.material;
        const blendType = (material.alphaToCoverage || material.alphaTest) ? BLEND_NORMAL : material.blendType;

        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 27 - 30 : layer
        // 26      : translucency type (opaque/transparent)
        // 25      : unused
        // 0 - 24  : Material ID (if opaque) or 0 (if transparent - will be depth)
        this._key[SORTKEY_FORWARD] =
            ((this.layer & 0x0f) << 27) |
            ((blendType === BLEND_NONE ? 1 : 0) << 26) |
            ((material.id & 0x1ffffff) << 0);
    }

    /**
     * Sets up {@link MeshInstance} to be rendered using Hardware Instancing.
     *
     * @param {import('../platform/graphics/vertex-buffer.js').VertexBuffer|null} vertexBuffer -
     * Vertex buffer to hold per-instance vertex data (usually world matrices). Pass null to turn
     * off hardware instancing.
     * @param {boolean} cull - Whether to perform frustum culling on this instance. If true, the whole
     * instance will be culled by the  camera frustum. This often involves setting
     * {@link RenderComponent#customAabb} containing all instances. Defaults to false, which means
     * the whole instance is always rendered.
     */
    setInstancing(vertexBuffer, cull = false) {
        if (vertexBuffer) {
            this.instancingData = new InstancingData(vertexBuffer.numVertices);
            this.instancingData.vertexBuffer = vertexBuffer;

            // mark vertex buffer as instancing data
            vertexBuffer.format.instancing = true;

            // set up culling
            this.cull = cull;
        } else {
            this.instancingData = null;
            this.cull = true;
        }

        this._updateShaderDefs(vertexBuffer ? (this._shaderDefs | SHADERDEF_INSTANCING) : (this._shaderDefs & ~SHADERDEF_INSTANCING));
    }

    ensureMaterial(device) {
        if (!this.material) {
            Debug.warn(`Mesh attached to entity '${this.node.name}' does not have a material, using a default one.`);
            this.material = getDefaultMaterial(device);
        }
    }

    // Parameter management
    clearParameters() {
        this.parameters = {};
    }

    getParameters() {
        return this.parameters;
    }

    /**
     * Retrieves the specified shader parameter from a mesh instance.
     *
     * @param {string} name - The name of the parameter to query.
     * @returns {object} The named parameter.
     */
    getParameter(name) {
        return this.parameters[name];
    }

    /**
     * Sets a shader parameter on a mesh instance. Note that this parameter will take precedence
     * over parameter of the same name if set on Material this mesh instance uses for rendering.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|import('../platform/graphics/texture.js').Texture} data - The value
     * for the specified parameter.
     * @param {number} [passFlags] - Mask describing which passes the material should be included
     * in.
     */
    setParameter(name, data, passFlags = -262141) {

        // note on -262141: All bits set except 2 - 19 range

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

        const param = this.parameters[name];
        if (param) {
            param.data = data;
            param.passFlags = passFlags;
        } else {
            this.parameters[name] = {
                scopeId: null,
                data: data,
                passFlags: passFlags
            };
        }
    }

    // a wrapper over settings parameter specifically for realtime baked lightmaps. This handles reference counting of lightmaps
    // and releases them when no longer referenced
    setRealtimeLightmap(name, texture) {

        // no change
        const old = this.getParameter(name);
        if (old === texture)
            return;

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
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    }

    // used to apply parameters from this mesh instance into scope of uniforms, called internally by forward-renderer
    setParameters(device, passFlag) {
        const parameters = this.parameters;
        for (const paramName in parameters) {
            const parameter = parameters[paramName];
            if (parameter.passFlags & passFlag) {
                if (!parameter.scopeId) {
                    parameter.scopeId = device.scope.resolve(paramName);
                }
                parameter.scopeId.setValue(parameter.data);
            }
        }
    }

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

    _setupSkinUpdate() {

        // set if bones need to be updated before culling
        if (this._skinInstance) {
            this._skinInstance._updateBeforeCull = !this._customAabb;
        }
    }
}

export { MeshInstance };
