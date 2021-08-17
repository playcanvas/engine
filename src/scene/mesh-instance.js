import { RefCountedCache } from '../core/ref-counted-cache.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';

import {
    BLEND_NONE, BLEND_NORMAL,
    LAYER_WORLD,
    MASK_DYNAMIC, MASK_LIGHTMAP, MASK_BAKED,
    RENDERSTYLE_SOLID,
    SHADER_FORWARD, SHADER_FORWARDHDR,
    SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, SHADERDEF_NOSHADOW, SHADERDEF_SKIN,
    SHADERDEF_SCREENSPACE, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_LM, SHADERDEF_DIRLM,
    SORTKEY_FORWARD
} from './constants.js';

import { GraphNode } from './graph-node.js';

var _tmpAabb = new BoundingBox();
var _tempBoneAabb = new BoundingBox();
var _tempSphere = new BoundingSphere();
var _meshSet = new Set();


// internal data structure used to store data used by hardware instancing
class InstancingData {
    constructor(numObjects) {
        this.count = numObjects;
        this.vertexBuffer = null;
    }
}

class Command {
    constructor(layer, blendType, command) {
        this._key = [];
        this._key[SORTKEY_FORWARD] = getKey(layer, blendType, true, 0);
        this.command = command;
    }

    get key() {
        return this._key[SORTKEY_FORWARD];
    }

    set key(val) {
        this._key[SORTKEY_FORWARD] = val;
    }
}

/**
 * @class
 * @name MeshInstance
 * @classdesc An instance of a {@link Mesh}. A single mesh can be referenced by many
 * mesh instances that can have different transforms and materials.
 * @description Create a new mesh instance.
 * @param {Mesh} mesh - The graphics mesh being instanced.
 * @param {Material} material - The material used to render this instance.
 * @param {GraphNode} [node] - The graph node defining the transform for this instance. This parameter is optional when used with {@link RenderComponent} and will use the node the component is attached to.
 * @property {BoundingBox} aabb The world space axis-aligned bounding box for this mesh instance.
 * @property {MorphInstance} morphInstance The morph instance managing morphing of this mesh instance, or null if morphing is not used.
 * @property {boolean} visible Enable rendering for this mesh instance. Use visible property to enable/disable rendering without overhead of removing from scene.
 * But note that the mesh instance is still in the hierarchy and still in the draw call list.
 * @property {GraphNode} node The graph node defining the transform for this instance.
 * @property {Mesh} mesh The graphics mesh being instanced.
 * @property {Material} material The material used by this mesh instance.
 * @property {number} renderStyle The render style of the mesh instance. Can be:
 *
 * * {@link RENDERSTYLE_SOLID}
 * * {@link RENDERSTYLE_WIREFRAME}
 * * {@link RENDERSTYLE_POINTS}
 *
 * Defaults to {@link RENDERSTYLE_SOLID}.
 * @property {boolean} cull Controls whether the mesh instance can be culled by with frustum culling ({@link CameraComponent#frustumCulling}).
 * @property {number} drawOrder Use this value to affect rendering order of mesh instances.
 * Only used when mesh instances are added to a {@link Layer} with {@link Layer#opaqueSortMode} or {@link Layer#transparentSortMode} (depending on the material) set to {@link SORTMODE_MANUAL}.
 * @property {callbacks.CalculateSortDistance} calculateSortDistance In some circumstances mesh instances are sorted by a distance calculation to determine their rendering order.
 * Set this callback to override the default distance calculation, which gives the dot product of the camera forward vector and the vector between the camera position and
 * the center of the mesh instance's axis-aligned bounding box. This option can be particularly useful for rendering transparent meshes in a better order than default.
 * @property {boolean} visibleThisFrame Read this value in {@link Layer#onPostCull} to determine if the object is actually going to be rendered.
 * @example
 * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
 * var mesh = pc.createBox(graphicsDevice);
 * var material = new pc.StandardMaterial();
 * var node = new pc.GraphNode();
 * var meshInstance = new pc.MeshInstance(mesh, material, node);
 *
 * @example
 * // A script you can attach on an entity to test if it is visible on a Layer
 * var MeshVisScript = pc.createScript('meshVisScript');
 * MeshVisScript.prototype.initialize = function () {
 *     var _this = this;
 *     this.app.scene.layers.getLayerByName("World").onPostCull = function (cameraIndex) {
 *         var meshInstance = _this.entity.model.model.meshInstances[0];
 *         console.log("visible: " + meshInstance.visibleThisFrame);
 *     };
 * };
 */
class MeshInstance {
    constructor(mesh, material, node = null) {

        // if first parameter is of GraphNode type, handle previous constructor signature: (node, mesh, material)
        if (mesh instanceof GraphNode) {
            const temp = mesh;
            mesh = material;
            material = node;
            node = temp;
        }

        this._key = [0, 0];
        this._shader = [null, null, null];

        this.isStatic = false;
        this._staticLightList = null;
        this._staticSource = null;

        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;          // The mesh that this instance renders
        mesh.incRefCount();
        this.material = material;   // The material with which to render this instance

        this._shaderDefs = MASK_DYNAMIC << 16; // 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = pc.MASK_DYNAMIC
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? SHADERDEF_UV0 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? SHADERDEF_UV1 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? SHADERDEF_VCOLOR : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasTangents ? SHADERDEF_TANGENTS : 0;

        this._lightHash = 0;

        // Render options
        this.visible = true;
        this.layer = LAYER_WORLD; // legacy
        this._renderStyle = RENDERSTYLE_SOLID;
        this.castShadow = false;
        this._receiveShadow = true;
        this._screenSpace = false;
        this._noDepthDrawGl1 = false;
        this.cull = true;

        // true if the meshInstance is pickable by Picker (by rendering ID to render target)
        this.pick = true;

        this._updateAabb = true;
        this._updateAabbFunc = null;
        this._calculateSortDistance = null;

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();

        this._skinInstance = null;
        this._morphInstance = null;
        this.instancingData = null;

        // override local space AABB
        this._customAabb = null;

        // World space AABB
        this.aabb = new BoundingBox();
        this._aabbVer = -1;

        this.drawOrder = 0;
        this.visibleThisFrame = 0;

        // custom function used to customize culling (e.g. for 2D UI elements)
        this.isVisibleFunc = null;

        this.parameters = {};

        this.stencilFront = null;
        this.stencilBack = null;
        // Negative scale batching support
        this.flipFaces = false;
    }

    // shader uniform names for lightmaps
    static lightmapParamNames = ["texture_lightMap", "texture_dirLightMap"];

    // cache of lightmaps internally created by baking using Lightmapper
    // this allows us to automatically release realtime baked lightmaps when mesh instances using them are destroyed
    static _lightmapCache = new RefCountedCache();

    // add texture reference to lightmap cache
    static incRefLightmap(texture) {
        this._lightmapCache.incRef(texture);
    }

    // remove texture reference from lightmap cache
    static decRefLightmap(texture) {
        this._lightmapCache.decRef(texture);
    }

    static destroyLightmapCache() {
        this._lightmapCache.destroy();
    }

    get renderStyle() {
        return this._renderStyle;
    }

    set renderStyle(renderStyle) {
        this._renderStyle = renderStyle;
        this.mesh.prepareRenderState(renderStyle);
    }

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

    get mesh() {
        return this._mesh;
    }

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

            } else if (this.node._aabbVer !== this._aabbVer) {

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
                    localAabb._expand(this.mesh.morph.aabb.getMin(), this.mesh.morph.aabb.getMax());
                }

                toWorldSpace = true;
                this._aabbVer = this.node._aabbVer;
            }
        }

        // store world space bounding box
        if (toWorldSpace) {
            this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
        }

        return this._aabb;
    }

    set aabb(aabb) {
        this._aabb = aabb;
    }

    get material() {
        return this._material;
    }

    set material(material) {
        for (let i = 0; i < this._shader.length; i++) {
            this._shader[i] = null;
        }

        var prevMat = this._material;

        // Remove the material's reference to this mesh instance
        if (prevMat) {
            prevMat.removeMeshInstanceRef(this);
        }

        this._material = material;

        if (this._material) {

            // Record that the material is referenced by this mesh instance
            this._material.addMeshInstanceRef(this);

            this.updateKey();

            var prevBlend = prevMat && (prevMat.blendType !== BLEND_NONE);
            var thisBlend = this._material.blendType !== BLEND_NONE;
            if (prevBlend !== thisBlend) {
                var scene = this._material._scene;
                if (!scene && prevMat && prevMat._scene) scene = prevMat._scene;

                if (scene) {
                    scene.layers._dirtyBlend = true;
                } else {
                    this._material._dirtyBlend = true;
                }
            }
        }
    }

    get layer() {
        return this._layer;
    }

    set layer(layer) {
        this._layer = layer;
        this.updateKey();
    }

    get calculateSortDistance() {
        return this._calculateSortDistance;
    }

    set calculateSortDistance(calculateSortDistance) {
        this._calculateSortDistance = calculateSortDistance;
    }

    get receiveShadow() {
        return this._receiveShadow;
    }

    set receiveShadow(val) {
        this._receiveShadow = val;
        this._shaderDefs = val ? (this._shaderDefs & ~SHADERDEF_NOSHADOW) : (this._shaderDefs | SHADERDEF_NOSHADOW);
        this._shader[SHADER_FORWARD] = null;
        this._shader[SHADER_FORWARDHDR] = null;
    }

    get skinInstance() {
        return this._skinInstance;
    }

    set skinInstance(val) {
        this._skinInstance = val;
        this._shaderDefs = val ? (this._shaderDefs | SHADERDEF_SKIN) : (this._shaderDefs & ~SHADERDEF_SKIN);
        for (var i = 0; i < this._shader.length; i++) {
            this._shader[i] = null;
        }

        this._setupSkinUpdate();
    }

    get morphInstance() {
        return this._morphInstance;
    }

    set morphInstance(val) {
        this._morphInstance = val;
        if (this._morphInstance) {
            this._morphInstance.meshInstance = this;
        }

        this._shaderDefs = (val && val.morph.useTextureMorph) ? (this._shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED) : (this._shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED);
        this._shaderDefs = (val && val.morph.morphPositions) ? (this._shaderDefs | SHADERDEF_MORPH_POSITION) : (this._shaderDefs & ~SHADERDEF_MORPH_POSITION);
        this._shaderDefs = (val && val.morph.morphNormals) ? (this._shaderDefs | SHADERDEF_MORPH_NORMAL) : (this._shaderDefs & ~SHADERDEF_MORPH_NORMAL);
        for (var i = 0; i < this._shader.length; i++) {
            this._shader[i] = null;
        }
    }

    get screenSpace() {
        return this._screenSpace;
    }

    set screenSpace(val) {
        this._screenSpace = val;
        this._shaderDefs = val ? (this._shaderDefs | SHADERDEF_SCREENSPACE) : (this._shaderDefs & ~SHADERDEF_SCREENSPACE);
        this._shader[SHADER_FORWARD] = null;
    }

    get key() {
        return this._key[SORTKEY_FORWARD];
    }

    set key(val) {
        this._key[SORTKEY_FORWARD] = val;
    }

    /**
     * @name MeshInstance#mask
     * @type {number}
     * @description Mask controlling which {@link LightComponent}s light this mesh instance, which {@link CameraComponent} sees it and in which {@link Layer} it is rendered.
     * Defaults to 1.
     */
    get mask() {
        return this._shaderDefs >> 16;
    }

    set mask(val) {
        var toggles = this._shaderDefs & 0x0000FFFF;
        this._shaderDefs = toggles | (val << 16);
        this._shader[SHADER_FORWARD] = null;
        this._shader[SHADER_FORWARDHDR] = null;
    }

    /**
     * @name MeshInstance#instancingCount
     * @type {number}
     * @description Number of instances when using hardware instancing to render the mesh.
     */
    get instancingCount() {
        return this.instancingData ? this.instancingData.count : 0;
    }

    set instancingCount(value) {
        if (this.instancingData)
            this.instancingData.count = value;
    }

    destroy() {

        const mesh = this.mesh;
        if (mesh) {

            // this decreases ref count on the mesh
            this.mesh = null;

            // destroy mesh
            if (mesh.getRefCount() < 1) {
                mesh.destroy();
            }
        }

        // release ref counted lightmaps
        this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
        this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);

        if (this._skinInstance) {
            this._skinInstance.destroy();
            this._skinInstance = null;
        }

        if (this.morphInstance) {
            this.morphInstance.destroy();
            this.morphInstance = null;
        }

        // make sure material clears references to this meshInstance
        this.material = null;
    }

    syncAabb() {
        // Deprecated
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
        var material = this.material;
        this._key[SORTKEY_FORWARD] = getKey(this.layer,
                                            (material.alphaToCoverage || material.alphaTest) ? BLEND_NORMAL : material.blendType, // render alphatest/atoc after opaque
                                            false, material.id);
    }

    /**
     * @function
     * @name MeshInstance#setInstancing
     * @description Sets up {@link MeshInstance} to be rendered using Hardware Instancing.
     * @param {VertexBuffer|null} vertexBuffer - Vertex buffer to hold per-instance vertex data (usually world matrices).
     * Pass null to turn off hardware instancing.
     */
    setInstancing(vertexBuffer) {
        if (vertexBuffer) {
            this.instancingData = new InstancingData(vertexBuffer.numVertices);
            this.instancingData.vertexBuffer = vertexBuffer;

            // mark vertex buffer as instancing data
            vertexBuffer.instancing = true;

            // turn off culling - we do not do per-instance culling, all instances are submitted to GPU
            this.cull = false;
        } else {
            this.instancingData = null;
            this.cull = true;
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
     * @function
     * @name MeshInstance#getParameter
     * @description Retrieves the specified shader parameter from a mesh instance.
     * @param {string} name - The name of the parameter to query.
     * @returns {object} The named parameter.
     */
    getParameter(name) {
        return this.parameters[name];
    }

    /**
     * @function
     * @name MeshInstance#setParameter
     * @description Sets a shader parameter on a mesh instance. Note that this parameter will take precedence over parameter of the same name
     * if set on Material this mesh instance uses for rendering.
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|Texture} data - The value for the specified parameter.
     * @param {number} [passFlags] - Mask describing which passes the material should be included in.
     */
    setParameter(name, data, passFlags = -262141) {

        // note on -262141: All bits set except 2 - 19 range

        if (data === undefined && typeof name === 'object') {
            var uniformObject = name;
            if (uniformObject.length) {
                for (var i = 0; i < uniformObject.length; i++) {
                    this.setParameter(uniformObject[i]);
                }
                return;
            }
            name = uniformObject.name;
            data = uniformObject.value;
        }

        var param = this.parameters[name];
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
            MeshInstance.decRefLightmap(old.data);
        }

        // assign new
        if (texture) {
            MeshInstance.incRefLightmap(texture);
            this.setParameter(name, texture);
        } else {
            this.deleteParameter(name);
        }
    }

     /**
      * @function
      * @name MeshInstance#deleteParameter
      * @description Deletes a shader parameter on a mesh instance.
      * @param {string} name - The name of the parameter to delete.
      */
    deleteParameter(name) {
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    }

    // used to apply parameters from this mesh instance into scope of uniforms, called internally by forward-renderer
    setParameters(device, passFlag) {
        var parameter, parameters = this.parameters;
        for (var paramName in parameters) {
            parameter = parameters[paramName];
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
            this.mask = (this.mask | MASK_BAKED) & ~(MASK_DYNAMIC | MASK_LIGHTMAP);
        } else {
            this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
            this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
            this._shaderDefs &= ~(SHADERDEF_LM | SHADERDEF_DIRLM);
            this.mask = (this.mask | MASK_DYNAMIC) & ~(MASK_BAKED | MASK_LIGHTMAP);
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

function getKey(layer, blendType, isCommand, materialId) {
    // Key definition:
    // Bit
    // 31      : sign bit (leave)
    // 27 - 30 : layer
    // 26      : translucency type (opaque/transparent)
    // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
    // 0 - 24  : Material ID (if opaque) or 0 (if transparent - will be depth)
    return ((layer & 0x0f) << 27) |
           ((blendType === BLEND_NONE ? 1 : 0) << 26) |
           ((isCommand ? 1 : 0) << 25) |
           ((materialId & 0x1ffffff) << 0);
}

export { Command, MeshInstance };
