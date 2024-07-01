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
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { hash32Fnv1a } from '../core/hash.js';
import { array } from '../core/array-utils.js';

let id = 0;
const _tmpAabb = new BoundingBox();
const _tempBoneAabb = new BoundingBox();
const _tempSphere = new BoundingSphere();

/** @type {Set<import('./mesh.js').Mesh>} */
const _meshSet = new Set();

// internal array used to evaluate the hash for the shader instance
const lookupHashes = new Uint32Array(4);

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
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
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
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
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
     * Enable shadow casting for this mesh instance. Use this property to enable/disable shadow
     * casting without overhead of removing from scene. Note that this property does not add the
     * mesh instance to appropriate list of shadow casters on a {@link Layer}, but allows mesh to
     * be skipped from shadow casting while it is in the list already. Defaults to false.
     *
     * @type {boolean}
     */
    castShadow = false;

    /**
     * Controls whether the mesh instance can be culled by frustum culling (see
     * {@link CameraComponent#frustumCulling}). Defaults to true.
     *
     * @type {boolean}
     */
    cull = true;

    /**
     * Determines the rendering order of mesh instances. Only used when mesh instances are added to
     * a {@link Layer} with {@link Layer#opaqueSortMode} or {@link Layer#transparentSortMode}
     * (depending on the material) set to {@link SORTMODE_MANUAL}.
     *
     * @type {number}
     */
    drawOrder = 0;

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
     *
     * @type {boolean}
     */
    visible = true;

    /**
     * Read this value in {@link Layer#onPostCull} to determine if the object is actually going to
     * be rendered.
     *
     * @type {boolean}
     */
    visibleThisFrame = false;

    /**
     * Negative scale batching support.
     *
     * @type {number}
     * @ignore
     */
    flipFacesFactor = 1;

    /**
     * @type {import('./gsplat/gsplat-instance.js').GSplatInstance|null}
     * @ignore
     */
    gsplatInstance = null;

    /** @ignore */
    id = id++;

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
     * @type {Record<string, {scopeId: import('../platform/graphics/scope-id.js').ScopeId|null, data: any, passFlags: number}>}
     * @ignore
     */
    parameters = {};

    /**
     * True if the mesh instance is pickable by the {@link Picker}. Defaults to true.
     *
     * @type {boolean}
     * @ignore
     */
    pick = true;

    /**
     * The stencil parameters for front faces or null if no stencil is enabled.
     *
     * @type {import('../platform/graphics/stencil-parameters.js').StencilParameters|null}
     * @ignore
     */
    stencilFront = null;

    /**
     * The stencil parameters for back faces or null if no stencil is enabled.
     *
     * @type {import('../platform/graphics/stencil-parameters.js').StencilParameters|null}
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

    /** @private */
    _key = [0, 0];

    /** @private */
    _layer = LAYER_WORLD;

    /**
     * @type {import('./materials/material.js').Material|null}
     * @private
     */
    _material = null;

    /**
     * @type {import('./skin-instance.js').SkinInstance|null}
     * @private
     */
    _skinInstance = null;

    /**
     * @type {import('./morph-instance.js').MorphInstance|null}
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
     * 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = pc.MASK_AFFECT_DYNAMIC
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
     * @param {import('./mesh.js').Mesh} mesh - The graphics mesh to instance.
     * @param {import('./materials/material.js').Material} material - The material to use for this
     * mesh instance.
     * @param {GraphNode} [node] - The graph node defining the transform for this instance. This
     * parameter is optional when used with {@link RenderComponent} and will use the node the
     * component is attached to.
     * @example
     * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
     * const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.BoxGeometry());
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

        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;          // The mesh that this instance renders
        mesh.incRefCount();
        this.material = material;   // The material with which to render this instance

        if (mesh.vertexBuffer) {
            const format = mesh.vertexBuffer.format;
            this._shaderDefs |= format.hasUv0 ? SHADERDEF_UV0 : 0;
            this._shaderDefs |= format.hasUv1 ? SHADERDEF_UV1 : 0;
            this._shaderDefs |= format.hasColor ? SHADERDEF_VCOLOR : 0;
            this._shaderDefs |= format.hasTangents ? SHADERDEF_TANGENTS : 0;
        }

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();
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

    /**
     * Gets the graphics mesh being instanced.
     *
     * @type {import('./mesh.js').Mesh}
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
     * Returns the shader instance for the specified shader pass and light hash that is compatible
     * with this mesh instance.
     *
     * @param {number} shaderPass - The shader pass index.
     * @param {number} lightHash - The hash value of the lights that are affecting this mesh instance.
     * @param {import('./scene.js').Scene} scene - The scene.
     * @param {import('./renderer/rendering-params.js').RenderingParams} renderParams - The rendering
     * parameters.
     * @param {import('../platform/graphics/uniform-buffer-format.js').UniformBufferFormat} [viewUniformFormat] - The
     * format of the view uniform buffer.
     * @param {import('../platform/graphics/bind-group-format.js').BindGroupFormat} [viewBindGroupFormat] - The
     * format of the view bind group.
     * @param {any} [sortedLights] - Array of arrays of lights.
     * @returns {ShaderInstance} - the shader instance.
     * @ignore
     */
    getShaderInstance(shaderPass, lightHash, scene, renderParams, viewUniformFormat, viewBindGroupFormat, sortedLights) {

        const shaderDefs = this._shaderDefs;

        // unique hash for the required shader
        lookupHashes[0] = shaderPass;
        lookupHashes[1] = lightHash;
        lookupHashes[2] = shaderDefs;
        lookupHashes[3] = renderParams.hash;
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

                const shader = mat.getShaderVariant(this.mesh.device, scene, shaderDefs, renderParams, shaderPass, sortedLights,
                                                    viewUniformFormat, viewBindGroupFormat, this._mesh.vertexBuffer?.format);

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

    /**
     * Gets the material used by this mesh instance.
     *
     * @type {import('./materials/material.js').Material}
     */
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

    /**
     * Sets the skin instance managing skinning of this mesh instance. Set to null if skinning is
     * not used.
     *
     * @type {import('./skin-instance.js').SkinInstance|null}
     */
    set skinInstance(val) {
        this._skinInstance = val;
        this._updateShaderDefs(val ? (this._shaderDefs | SHADERDEF_SKIN) : (this._shaderDefs & ~SHADERDEF_SKIN));
        this._setupSkinUpdate();
    }

    /**
     * Gets the skin instance managing skinning of this mesh instance.
     *
     * @type {import('./skin-instance.js').SkinInstance|null}
     */
    get skinInstance() {
        return this._skinInstance;
    }

    /**
     * Sets the morph instance managing morphing of this mesh instance. Set to null if morphing is
     * not used.
     *
     * @type {import('./morph-instance.js').MorphInstance|null}
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

    /**
     * Gets the morph instance managing morphing of this mesh instance.
     *
     * @type {import('./morph-instance.js').MorphInstance|null}
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
        this._key[SORTKEY_FORWARD] = val;
    }

    get key() {
        return this._key[SORTKEY_FORWARD];
    }

    /**
     * Sets the mask controlling which {@link LightComponent}s light this mesh instance, which
     * {@link CameraComponent} sees it and in which {@link Layer} it is rendered. Defaults to 1.
     *
     * @type {number}
     */
    set mask(val) {
        const toggles = this._shaderDefs & 0x0000FFFF;
        this._updateShaderDefs(toggles | (val << 16));
    }

    /**
     * Gets the mask controlling which {@link LightComponent}s light this mesh instance, which
     * {@link CameraComponent} sees it and in which {@link Layer} it is rendered.
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
        if (this.instancingData)
            this.instancingData.count = value;
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

        // make sure material clears references to this meshInstance
        this.material = null;
    }

    // shader uniform names for lightmaps
    static lightmapParamNames = ['texture_lightMap', 'texture_dirLightMap'];

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
     * @param {import('./camera.js').Camera} camera - The camera to test visibility against.
     * @returns {boolean} - True if the mesh instance is visible by the camera, false otherwise.
     * @ignore
     */
    _isVisible(camera) {

        if (this.visible) {

            // custom visibility method of MeshInstance
            if (this.isVisibleFunc) {
                return this.isVisibleFunc(camera);
            }

            _tempSphere.center = this.aabb.center;  // this line evaluates aabb
            _tempSphere.radius = this._aabb.halfExtents.length();

            return camera.frustum.containsSphere(_tempSphere) > 0;
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
     * @param {number|number[]|import('../platform/graphics/texture.js').Texture|Float32Array} data - The
     * value for the specified parameter.
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

    /**
     * A wrapper over settings parameter specifically for realtime baked lightmaps. This handles
     * reference counting of lightmaps and releases them when no longer referenced.
     *
     * @param {string} name - The name of the parameter to set.
     * @param {import('../platform/graphics/texture.js').Texture|null} texture - The lightmap
     * texture to set.
     * @ignore
     */
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

    /**
     * Used to apply parameters from this mesh instance into scope of uniforms, called internally
     * by forward-renderer.
     *
     * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @param {number} passFlag - The pass flag for the current render pass.
     * @ignore
     */
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
