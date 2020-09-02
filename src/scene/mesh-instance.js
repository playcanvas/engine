import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';

import {
    BLEND_NONE, BLEND_NORMAL,
    LAYER_WORLD,
    MASK_DYNAMIC,
    RENDERSTYLE_SOLID,
    SHADER_FORWARD, SHADER_FORWARDHDR,
    SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, SHADERDEF_NOSHADOW, SHADERDEF_SKIN,
    SHADERDEF_SCREENSPACE, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED,
    SORTKEY_FORWARD
} from './constants.js';

var _tmpAabb = new BoundingBox();
var _tempBoneAabb = new BoundingBox();
var _tempSphere = new BoundingSphere();

/**
 * @class
 * @name pc.MeshInstance
 * @classdesc An instance of a {@link pc.Mesh}. A single mesh can be referenced by many
 * mesh instances that can have different transforms and materials.
 * @description Create a new mesh instance.
 * @param {pc.GraphNode} node - The graph node defining the transform for this instance.
 * @param {pc.Mesh} mesh - The graphics mesh being instanced.
 * @param {pc.Material} material - The material used to render this instance.
 * @property {pc.BoundingBox} aabb The world space axis-aligned bounding box for this
 * mesh instance.
 * @property {boolean} castShadow Controls whether the mesh instance casts shadows.
 * Defaults to false.
 * @property {boolean} visible Enable rendering for this mesh instance. Use visible property to enable/disable rendering without overhead of removing from scene.
 * But note that the mesh instance is still in the hierarchy and still in the draw call list.
 * @property {pc.GraphNode} node The graph node defining the transform for this instance.
 * @property {pc.Mesh} mesh The graphics mesh being instanced.
 * @property {pc.Material} material The material used by this mesh instance.
 * @property {number} renderStyle The render style of the mesh instance. Can be:
 *
 * * {@link pc.RENDERSTYLE_SOLID}
 * * {@link pc.RENDERSTYLE_WIREFRAME}
 * * {@link pc.RENDERSTYLE_POINTS}
 *
 * Defaults to pc.RENDERSTYLE_SOLID.
 * @property {boolean} cull Controls whether the mesh instance can be culled by with frustum culling ({@link pc.CameraComponent#frustumCulling}).
 * @property {number} drawOrder Use this value to affect rendering order of mesh instances.
 * Only used when mesh instances are added to a {@link pc.Layer} with {@link pc.Layer#opaqueSortMode} or {@link pc.Layer#transparentSortMode} (depending on the material) set to {@link pc.SORTMODE_MANUAL}.
 * @property {pc.callbacks.CalculateSortDistance} calculateSortDistance In some circumstances mesh instances are sorted by a distance calculation to determine their rendering order.
 * Set this callback to override the default distance calculation, which gives the dot product of the camera forward vector and the vector between the camera position and
 * the center of the mesh instance's axis-aligned bounding box. This option can be particularly useful for rendering transparent meshes in a better order than default.
 * @property {boolean} visibleThisFrame Read this value in {@link pc.Layer#onPostCull} to determine if the object is actually going to be rendered.
 * @example
 * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
 * var mesh = pc.createBox(graphicsDevice);
 * var material = new pc.StandardMaterial();
 * var node = new pc.GraphNode();
 * var meshInstance = new pc.MeshInstance(node, mesh, material);
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
function MeshInstance(node, mesh, material) {
    this._key = [0, 0];
    this._shader = [null, null, null];

    this.isStatic = false;
    this._staticLightList = null;
    this._staticSource = null;

    this.node = node;           // The node that defines the transform of the mesh instance
    this._mesh = mesh;           // The mesh that this instance renders
    mesh.incReference();
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
    this.renderStyle = RENDERSTYLE_SOLID;
    this.castShadow = false;
    this._receiveShadow = true;
    this._screenSpace = false;
    this._noDepthDrawGl1 = false;
    this.cull = true;
    this.pick = true;
    this._updateAabb = true;
    this._updateAabbFunc = null;
    this._calculateSortDistance = null;

    // 64-bit integer key that defines render order of this mesh instance
    this.updateKey();

    this._skinInstance = null;
    this._morphInstance = null;
    this.instancingData = null;

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

Object.defineProperty(MeshInstance.prototype, 'mesh', {
    get: function () {
        return this._mesh;
    },
    set: function (mesh) {
        if (this._mesh) this._mesh.decReference();
        this._mesh = mesh;
        if (mesh) mesh.incReference();
    }
});

Object.defineProperty(MeshInstance.prototype, 'aabb', {
    get: function () {
        var i;

        if (!this._updateAabb) {
            return this._aabb;
        }

        if (this._updateAabbFunc) {
            return this._updateAabbFunc(this._aabb);
        }

        if (this.skinInstance) {

            // Initialize local bone AABBs if needed
            if (!this.mesh.boneAabb) {
                var morphTargets = this._morphInstance ? this._morphInstance.morph._targets : null;
                this.mesh._initBoneAabbs(morphTargets);
            }

            // evaluate world space bounds based on all active bones
            var boneUsed = this.mesh.boneUsed;
            var rootNodeTransform = this.node.getWorldTransform();
            var first = true;

            for (i = 0; i < this.mesh.boneAabb.length; i++) {
                if (boneUsed[i]) {

                    // transform bone AABB by bone matrix
                    _tempBoneAabb.setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);

                    // add them up
                    if (first) {
                        first = false;
                        _tmpAabb.center.copy(_tempBoneAabb.center);
                        _tmpAabb.halfExtents.copy(_tempBoneAabb.halfExtents);
                    } else {
                        _tmpAabb.add(_tempBoneAabb);
                    }
                }
            }

            // store world space bounding box
            this._aabb.setFromTransformedAabb(_tmpAabb, rootNodeTransform);

        } else if (this.node._aabbVer !== this._aabbVer) {

            // local space bounding box - either from mesh or empty
            if (this.mesh) {
                _tmpAabb.center.copy(this.mesh.aabb.center);
                _tmpAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
            } else {
                _tmpAabb.center.set(0, 0, 0);
                _tmpAabb.halfExtents.set(0, 0, 0);
            }

            // update local space bounding box by morph targets
            if (this.mesh && this.mesh.morph) {
                _tmpAabb._expand(this.mesh.morph.aabb.getMin(), this.mesh.morph.aabb.getMax());
            }

            // store world space bounding box
            this._aabb.setFromTransformedAabb(_tmpAabb, this.node.getWorldTransform());
            this._aabbVer = this.node._aabbVer;
        }
        return this._aabb;
    },
    set: function (aabb) {
        this._aabb = aabb;
    }
});

Object.defineProperty(MeshInstance.prototype, 'material', {
    get: function () {
        return this._material;
    },
    set: function (material) {
        var i;
        for (i = 0; i < this._shader.length; i++) {
            this._shader[i] = null;
        }
        // Remove the material's reference to this mesh instance
        if (this._material) {
            var meshInstances = this._material.meshInstances;
            i = meshInstances.indexOf(this);
            if (i !== -1) {
                meshInstances.splice(i, 1);
            }
        }

        var prevMat = this._material;

        this._material = material;

        if (this._material) {
            // Record that the material is referenced by this mesh instance
            this._material.meshInstances.push(this);

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
});

Object.defineProperty(MeshInstance.prototype, 'layer', {
    get: function () {
        return this._layer;
    },
    set: function (layer) {
        this._layer = layer;
        this.updateKey();
    }
});

Object.defineProperty(MeshInstance.prototype, 'calculateSortDistance', {
    get: function () {
        return this._calculateSortDistance;
    },
    set: function (calculateSortDistance) {
        this._calculateSortDistance = calculateSortDistance;
    }
});

Object.defineProperty(MeshInstance.prototype, 'receiveShadow', {
    get: function () {
        return this._receiveShadow;
    },
    set: function (val) {
        this._receiveShadow = val;
        this._shaderDefs = val ? (this._shaderDefs & ~SHADERDEF_NOSHADOW) : (this._shaderDefs | SHADERDEF_NOSHADOW);
        this._shader[SHADER_FORWARD] = null;
        this._shader[SHADER_FORWARDHDR] = null;
    }
});

Object.defineProperty(MeshInstance.prototype, 'skinInstance', {
    get: function () {
        return this._skinInstance;
    },
    set: function (val) {
        this._skinInstance = val;
        this._shaderDefs = val ? (this._shaderDefs | SHADERDEF_SKIN) : (this._shaderDefs & ~SHADERDEF_SKIN);
        for (var i = 0; i < this._shader.length; i++) {
            this._shader[i] = null;
        }
    }
});

Object.defineProperty(MeshInstance.prototype, 'morphInstance', {
    get: function () {
        return this._morphInstance;
    },
    set: function (val) {
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
});

Object.defineProperty(MeshInstance.prototype, 'screenSpace', {
    get: function () {
        return this._screenSpace;
    },
    set: function (val) {
        this._screenSpace = val;
        this._shaderDefs = val ? (this._shaderDefs | SHADERDEF_SCREENSPACE) : (this._shaderDefs & ~SHADERDEF_SCREENSPACE);
        this._shader[SHADER_FORWARD] = null;
    }
});

Object.defineProperty(MeshInstance.prototype, 'key', {
    get: function () {
        return this._key[SORTKEY_FORWARD];
    },
    set: function (val) {
        this._key[SORTKEY_FORWARD] = val;
    }
});

/**
 * @name pc.MeshInstance#mask
 * @type {number}
 * @description Mask controlling which {@link pc.LightComponent}s light this mesh instance, which {@link pc.CameraComponent} sees it and in which {@link pc.Layer} it is rendered.
 * Defaults to 1.
 */
Object.defineProperty(MeshInstance.prototype, 'mask', {
    get: function () {
        return this._shaderDefs >> 16;
    },
    set: function (val) {
        var toggles = this._shaderDefs & 0x0000FFFF;
        this._shaderDefs = toggles | (val << 16);
        this._shader[SHADER_FORWARD] = null;
        this._shader[SHADER_FORWARDHDR] = null;
    }
});

/**
 * @name pc.MeshInstance#instancingCount
 * @type {number}
 * @description Number of instances when using hardware instancing to render the mesh.
 */
Object.defineProperty(MeshInstance.prototype, 'instancingCount', {
    get: function () {
        return this.instancingData ? this.instancingData.count : 0;
    },
    set: function (value) {
        if (this.instancingData)
            this.instancingData.count = value;
    }
});

Object.assign(MeshInstance.prototype, {
    syncAabb: function () {
        // Deprecated
    },

    // test if meshInstance is visible by camera. It requires the frustum of the camera to be up to date, which forward-renderer
    // takes care of. This function should  not be called elsewhere.
    _isVisible: function (camera) {

        if (this.visible) {

            // custom visibility method of MeshInstance
            if (this.isVisibleFunc) {
                return this.isVisibleFunc(camera);
            }

            var pos = this.aabb.center;
            if (this._aabb._radiusVer !== this._aabbVer) {
                this._aabb._radius = this._aabb.halfExtents.length();
                this._aabb._radiusVer = this._aabbVer;
            }

            _tempSphere.radius = this._aabb._radius;
            _tempSphere.center = pos;

            return camera.frustum.containsSphere(_tempSphere);
        }

        return false;
    },

    updateKey: function () {
        var material = this.material;
        this._key[SORTKEY_FORWARD] = getKey(this.layer,
                                            (material.alphaToCoverage || material.alphaTest) ? BLEND_NORMAL : material.blendType, // render alphatest/atoc after opaque
                                            false, material.id);
    },

    /**
     * @function
     * @name pc.MeshInstance#setInstancing
     * @description Sets up {@link pc.MeshInstance} to be rendered using Hardware Instancing.
     * @param {pc.VertexBuffer|null} vertexBuffer - Vertex buffer to hold per-instance vertex data (usually world matrices).
     * Pass null to turn off hardware instancing.
     */
    setInstancing: function (vertexBuffer) {
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
    },

    // Parameter management
    clearParameters: function () {
        this.parameters = {};
    },

    getParameters: function () {
        return this.parameters;
    },

    /**
     * @function
     * @name pc.MeshInstance#getParameter
     * @description Retrieves the specified shader parameter from a mesh instance.
     * @param {string} name - The name of the parameter to query.
     * @returns {object} The named parameter.
     */
    getParameter: function (name) {
        return this.parameters[name];
    },

    /**
     * @function
     * @name pc.MeshInstance#setParameter
     * @description Sets a shader parameter on a mesh instance. Note that this parameter will take precedence over parameter of the same name
     * if set on Material this mesh instance uses for rendering.
     * @param {string} name - The name of the parameter to set.
     * @param {number|number[]|pc.Texture} data - The value for the specified parameter.
     */
    setParameter: function (name, data) {

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
        } else {
            this.parameters[name] = {
                scopeId: null,
                data: data
            };
        }
    },

     /**
      * @function
      * @name pc.MeshInstance#deleteParameter
      * @description Deletes a shader parameter on a mesh instance.
      * @param {string} name - The name of the parameter to delete.
      */
    deleteParameter: function (name) {
        if (this.parameters[name]) {
            delete this.parameters[name];
        }
    },

    // used to apply parameters from this mesh instance into scope of uniforms, called internally by forward-renderer
    setParameters: function (device) {
        var parameter, parameters = this.parameters;
        for (var paramName in parameters) {
            parameter = parameters[paramName];
            if (!parameter.scopeId) {
                parameter.scopeId = device.scope.resolve(paramName);
            }
            parameter.scopeId.setValue(parameter.data);
        }
    }
});

function Command(layer, blendType, command) {
    this._key = [];
    this._key[SORTKEY_FORWARD] = getKey(layer, blendType, true, 0);
    this.command = command;
}

Object.defineProperty(Command.prototype, 'key', {
    get: function () {
        return this._key[SORTKEY_FORWARD];
    },
    set: function (val) {
        this._key[SORTKEY_FORWARD] = val;
    }
});

// internal data structure used to store data used by hardware instancing
function InstancingData(numObjects) {
    this.count = numObjects;
    this.vertexBuffer = null;
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
