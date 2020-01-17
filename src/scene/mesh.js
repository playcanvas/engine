Object.assign(pc, function () {
    var id = 0;
    var _tmpAabb = new pc.BoundingBox();

    /**
     * @class
     * @name pc.Mesh
     * @classdesc A graphical primitive. The mesh is defined by a {@link pc.VertexBuffer} and an optional
     * {@link pc.IndexBuffer}. It also contains a primitive definition which controls the type of the
     * primitive and the portion of the vertex or index buffer to use.
     * @description Create a new mesh.
     * @property {pc.VertexBuffer} vertexBuffer The vertex buffer holding the vertex data of the mesh.
     * @property {pc.IndexBuffer[]} indexBuffer An array of index buffers. For unindexed meshes, this array can
     * be empty. The first index buffer in the array is used by {@link pc.MeshInstance}s with a renderStyle
     * property set to pc.RENDERSTYLE_SOLID. The second index buffer in the array is used if renderStyle is
     * set to pc.RENDERSTYLE_WIREFRAME.
     * @property {object[]} primitive Array of primitive objects defining how vertex (and index) data in the
     * mesh should be interpreted by the graphics device. For details on the primitive object, see
     * @property {number} primitive[].type The type of primitive to render. Can be:
     * <ul>
     *     <li>{@link pc.PRIMITIVE_POINTS}</li>
     *     <li>{@link pc.PRIMITIVE_LINES}</li>
     *     <li>{@link pc.PRIMITIVE_LINELOOP}</li>
     *     <li>{@link pc.PRIMITIVE_LINESTRIP}</li>
     *     <li>{@link pc.PRIMITIVE_TRIANGLES}</li>
     *     <li>{@link pc.PRIMITIVE_TRISTRIP}</li>
     *     <li>{@link pc.PRIMITIVE_TRIFAN}</li>
     * </ul>
     * @property {number} primitive[].base The offset of the first index or vertex to dispatch in the draw call.
     * @property {number} primitive[].count The number of indices or vertices to dispatch in the draw call.
     * @property {boolean} [primitive[].indexed] True to interpret the primitive as indexed, thereby using the currently set index buffer and false otherwise.
     * {@link pc.GraphicsDevice#draw}. The primitive is ordered based on render style like the indexBuffer property.
     * @property {pc.BoundingBox} aabb The axis-aligned bounding box for the object space vertices of this mesh.
     */
    var Mesh = function () {
        this._refCount = 0;
        this.id = id++;
        this.vertexBuffer = null;
        this.indexBuffer = [null];
        this.primitive = [{
            type: 0,
            base: 0,
            count: 0
        }];
        this.skin = null;
        this.morph = null;

        // AABB for object space mesh vertices
        this._aabb = new pc.BoundingBox();

        // Array of object space AABBs of vertices affected by each bone
        this.boneAabb = null;
    };

    Object.defineProperty(Mesh.prototype, 'aabb', {
        get: function () {
            return this.morph ? this.morph.aabb : this._aabb;
        },
        set: function (aabb) {
            if (this.morph) {
                this._aabb = this.morph._baseAabb = aabb;
                this.morph._calculateAabb();
            } else {
                this._aabb = aabb;
            }
        }
    });

    /**
     * @class
     * @name pc.MeshInstance
     * @classdesc An instance of a {@link pc.Mesh}. A single mesh can be referenced by many
     * mesh instances that can have different transforms and materials.
     * @description Create a new mesh instance.
     * @param {pc.GraphNode} node The graph node defining the transform for this instance.
     * @param {pc.Mesh} mesh The graphics mesh being instanced.
     * @param {pc.Material} material The material used to render this instance.
     * @example
     * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
     * var mesh = pc.createBox(graphicsDevice);
     * var material = new pc.StandardMaterial();
     * var node = new pc.GraphNode();
     * var meshInstance = new pc.MeshInstance(node, mesh, material);
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
     * <ul>
     *     <li>pc.RENDERSTYLE_SOLID</li>
     *     <li>pc.RENDERSTYLE_WIREFRAME</li>
     *     <li>pc.RENDERSTYLE_POINTS</li>
     * </ul>
     * Defaults to pc.RENDERSTYLE_SOLID.
     * @property {boolean} cull Controls whether the mesh instance can be culled by with frustum culling ({@link pc.CameraComponent#frustumCulling}).
     * @property {number} drawOrder Use this value to affect rendering order of mesh instances.
     * Only used when mesh instances are added to a {@link pc.Layer} with {@link pc.Layer#opaqueSortMode} or {@link pc.Layer#transparentSortMode} (depending on the material) set to {@link pc.SORTMODE_MANUAL}.
     * @property {boolean} visibleThisFrame Read this value in {@link pc.Layer#onPostCull} to determine if the object is actually going to be rendered.
     */
    var MeshInstance = function MeshInstance(node, mesh, material) {
        this._key = [0, 0];
        this._shader = [null, null, null];

        this.isStatic = false;
        this._staticLightList = null;
        this._staticSource = null;

        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;           // The mesh that this instance renders
        mesh._refCount++;
        this.material = material;   // The material with which to render this instance

        this._shaderDefs = pc.MASK_DYNAMIC << 16; // 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = pc.MASK_DYNAMIC
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? pc.SHADERDEF_UV0 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? pc.SHADERDEF_UV1 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? pc.SHADERDEF_VCOLOR : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasTangents ? pc.SHADERDEF_TANGENTS : 0;

        this._lightHash = 0;

        // Render options
        this.visible = true;
        this.layer = pc.LAYER_WORLD; // legacy
        this.renderStyle = pc.RENDERSTYLE_SOLID;
        this.castShadow = false;
        this._receiveShadow = true;
        this._screenSpace = false;
        this._noDepthDrawGl1 = false;
        this.cull = true;
        this.pick = true;
        this._updateAabb = true;
        this._updateAabbFunc = null;

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();

        this._skinInstance = null;
        this.morphInstance = null;
        this.instancingData = null;

        // World space AABB
        this.aabb = new pc.BoundingBox();

        this._boneAabb = null;
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
    };

    Object.defineProperty(MeshInstance.prototype, 'mesh', {
        get: function () {
            return this._mesh;
        },
        set: function (mesh) {
            if (this._mesh) this._mesh._refCount--;
            this._mesh = mesh;
            if (mesh) mesh._refCount++;
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'aabb', {
        get: function () {
            var aabb;

            if (!this._updateAabb) return this._aabb;
            if (this._updateAabbFunc) {
                return this._updateAabbFunc(this._aabb);
            }

            if (this.skinInstance) {
                var numBones = this.mesh.skin.boneNames.length;
                var boneUsed, i;
                // Initialize local bone AABBs if needed
                if (!this.mesh.boneAabb) {

                    this.mesh.boneAabb = [];
                    this.mesh.boneUsed = [];
                    var elems = this.mesh.vertexBuffer.format.elements;
                    var numVerts = this.mesh.vertexBuffer.numVertices;
                    var vertSize = this.mesh.vertexBuffer.format.size;
                    var index;
                    var offsetP, offsetI, offsetW;
                    var j, k, l;
                    for (i = 0; i < elems.length; i++) {
                        if (elems[i].name === pc.SEMANTIC_POSITION) {
                            offsetP = elems[i].offset;
                        } else if (elems[i].name === pc.SEMANTIC_BLENDINDICES) {
                            offsetI = elems[i].offset;
                        } else if (elems[i].name === pc.SEMANTIC_BLENDWEIGHT) {
                            offsetW = elems[i].offset;
                        }
                    }

                    var data8 = new Uint8Array(this.mesh.vertexBuffer.storage);
                    var dataF = new Float32Array(this.mesh.vertexBuffer.storage);
                    var offsetPF = offsetP / 4;
                    var offsetWF = offsetW / 4;
                    var vertSizeF = vertSize / 4;

                    var bMax, bMin;
                    var x, y, z;
                    var boneMin = [];
                    var boneMax = [];
                    boneUsed = this.mesh.boneUsed;

                    for (i = 0; i < numBones; i++) {
                        boneMin[i] = new pc.Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                        boneMax[i] = new pc.Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
                    }

                    // Find bone AABBs by attached vertices
                    for (j = 0; j < numVerts; j++) {
                        for (k = 0; k < 4; k++) {
                            if (dataF[j * vertSizeF + offsetWF + k] > 0) {
                                index = data8[j * vertSize + offsetI + k];
                                // Vertex j is affected by bone index
                                x = dataF[j * vertSizeF + offsetPF];
                                y = dataF[j * vertSizeF + offsetPF + 1];
                                z = dataF[j * vertSizeF + offsetPF + 2];

                                bMax = boneMax[index];
                                bMin = boneMin[index];

                                if (bMin.x > x) bMin.x = x;
                                if (bMin.y > y) bMin.y = y;
                                if (bMin.z > z) bMin.z = z;

                                if (bMax.x < x) bMax.x = x;
                                if (bMax.y < y) bMax.y = y;
                                if (bMax.z < z) bMax.z = z;

                                boneUsed[index] = true;
                            }
                        }
                    }

                    // Apply morphing to bone AABBs
                    if (this.morphInstance) {
                        var vertIndex;
                        var targets = this.morphInstance.morph._targets;

                        // Find min/max morphed vertex positions
                        var minMorphedPos = new Float32Array(numVerts * 3);
                        var maxMorphedPos = new Float32Array(numVerts * 3);
                        var m, dx, dy, dz;
                        var target, mtIndices, mtIndicesLength, deltaPos;

                        for (j = 0; j < numVerts; j++) {
                            minMorphedPos[j * 3] = maxMorphedPos[j * 3] = dataF[j * vertSizeF + offsetPF];
                            minMorphedPos[j * 3 + 1] = maxMorphedPos[j * 3 + 1] = dataF[j * vertSizeF + offsetPF + 1];
                            minMorphedPos[j * 3 + 2] = maxMorphedPos[j * 3 + 2] = dataF[j * vertSizeF + offsetPF + 2];
                        }

                        for (l = 0; l < targets.length; l++) {
                            target = targets[l];
                            mtIndices = target.indices;
                            mtIndicesLength = mtIndices.length;
                            deltaPos = target.deltaPositions;
                            for (k = 0; k < mtIndicesLength; k++) {
                                vertIndex = mtIndices[k];

                                dx = deltaPos[k * 3];
                                dy = deltaPos[k * 3 + 1];
                                dz = deltaPos[k * 3 + 2];

                                if (dx < 0) {
                                    minMorphedPos[vertIndex * 3] += dx;
                                } else {
                                    maxMorphedPos[vertIndex * 3] += dx;
                                }

                                if (dy < 0) {
                                    minMorphedPos[vertIndex * 3 + 1] += dy;
                                } else {
                                    maxMorphedPos[vertIndex * 3 + 1] += dy;
                                }

                                if (dz < 0) {
                                    minMorphedPos[vertIndex * 3 + 2] += dz;
                                } else {
                                    maxMorphedPos[vertIndex * 3 + 2] += dz;
                                }
                            }
                        }

                        // Re-evaluate bone AABBs against min/max morphed positions
                        for (l = 0; l < targets.length; l++) {
                            target = targets[l];
                            mtIndices = target.indices;
                            mtIndicesLength = mtIndices.length;
                            deltaPos = target.deltaPositions;
                            for (k = 0; k < mtIndicesLength; k++) {
                                vertIndex = mtIndices[k];
                                for (m = 0; m < 4; m++) {
                                    if (dataF[vertIndex * vertSizeF + offsetWF + m] > 0) {
                                        index = data8[vertIndex * vertSize + offsetI + m];
                                        // Vertex vertIndex is affected by bone index
                                        bMax = boneMax[index];
                                        bMin = boneMin[index];

                                        x = minMorphedPos[vertIndex * 3];
                                        y = minMorphedPos[vertIndex * 3 + 1];
                                        z = minMorphedPos[vertIndex * 3 + 2];
                                        if (bMin.x > x) bMin.x = x;
                                        if (bMin.y > y) bMin.y = y;
                                        if (bMin.z > z) bMin.z = z;

                                        x = maxMorphedPos[vertIndex * 3];
                                        y = maxMorphedPos[vertIndex * 3 + 1];
                                        z = maxMorphedPos[vertIndex * 3 + 2];
                                        if (bMax.x < x) bMax.x = x;
                                        if (bMax.y < y) bMax.y = y;
                                        if (bMax.z < z) bMax.z = z;
                                    }
                                }
                            }
                        }
                    }

                    for (i = 0; i < numBones; i++) {
                        aabb = new pc.BoundingBox();
                        aabb.setMinMax(boneMin[i], boneMax[i]);
                        this.mesh.boneAabb.push(aabb);
                    }
                }

                // Initialize per-instance AABBs if needed
                if (!this._boneAabb) {
                    this._boneAabb = [];
                    for (i = 0; i < this.mesh.boneAabb.length; i++) {
                        this._boneAabb[i] = new pc.BoundingBox();
                    }
                }

                boneUsed = this.mesh.boneUsed;

                // Update per-instance bone AABBs
                for (i = 0; i < this.mesh.boneAabb.length; i++) {
                    if (!boneUsed[i]) continue;
                    this._boneAabb[i].setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);
                }

                // Update full instance AABB
                var rootNodeTransform = this.node.getWorldTransform();
                var first = true;
                for (i = 0; i < this.mesh.boneAabb.length; i++) {
                    if (!boneUsed[i]) continue;
                    if (first) {
                        _tmpAabb.center.copy(this._boneAabb[i].center);
                        _tmpAabb.halfExtents.copy(this._boneAabb[i].halfExtents);
                        first = false;
                    } else {
                        _tmpAabb.add(this._boneAabb[i]);
                    }
                }
                this._aabb.setFromTransformedAabb(_tmpAabb, rootNodeTransform);

            } else if (this.node._aabbVer !== this._aabbVer) {
                 // if there is no mesh then reset aabb
                aabb = this.mesh ? this.mesh.aabb : this._aabb;
                if (!this.mesh) {
                    aabb.center.set(0, 0, 0);
                    aabb.halfExtents.set(0, 0, 0);
                }

                this._aabb.setFromTransformedAabb(aabb, this.node.getWorldTransform());
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

            var prevBlend = this._material ? (this._material.blendType !== pc.BLEND_NONE) : false;
            var prevMat = this._material;
            this._material = material;

            if (this._material) {
                // Record that the material is referenced by this mesh instance
                this._material.meshInstances.push(this);

                this.updateKey();
            }

            if (material) {
                if ((material.blendType !== pc.BLEND_NONE) !== prevBlend) {

                    var scene = material._scene;
                    if (!scene && prevMat && prevMat._scene) scene = prevMat._scene;

                    if (scene) {
                        scene.layers._dirtyBlend = true;
                    } else {
                        material._dirtyBlend = true;
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

    Object.defineProperty(MeshInstance.prototype, 'receiveShadow', {
        get: function () {
            return this._receiveShadow;
        },
        set: function (val) {
            this._receiveShadow = val;
            this._shaderDefs = val ? (this._shaderDefs & ~pc.SHADERDEF_NOSHADOW) : (this._shaderDefs | pc.SHADERDEF_NOSHADOW);
            this._shader[pc.SHADER_FORWARD] = null;
            this._shader[pc.SHADER_FORWARDHDR] = null;
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'skinInstance', {
        get: function () {
            return this._skinInstance;
        },
        set: function (val) {
            this._skinInstance = val;
            this._shaderDefs = val ? (this._shaderDefs | pc.SHADERDEF_SKIN) : (this._shaderDefs & ~pc.SHADERDEF_SKIN);
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
            this._shaderDefs = val ? (this._shaderDefs | pc.SHADERDEF_SCREENSPACE) : (this._shaderDefs & ~pc.SHADERDEF_SCREENSPACE);
            this._shader[pc.SHADER_FORWARD] = null;
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'key', {
        get: function () {
            return this._key[pc.SORTKEY_FORWARD];
        },
        set: function (val) {
            this._key[pc.SORTKEY_FORWARD] = val;
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
            this._shader[pc.SHADER_FORWARD] = null;
            this._shader[pc.SHADER_FORWARDHDR] = null;
        }
    });

    Object.assign(MeshInstance.prototype, {
        syncAabb: function () {
            // Deprecated
        },

        updateKey: function () {
            var material = this.material;
            this._key[pc.SORTKEY_FORWARD] = getKey(this.layer,
                                                   (material.alphaToCoverage || material.alphaTest) ? pc.BLEND_NORMAL : material.blendType, // render alphatest/atoc after opaque
                                                   false, material.id);
        },

        setParameter: pc.Material.prototype.setParameter,
        setParameters: pc.Material.prototype.setParameters,
        deleteParameter: pc.Material.prototype.deleteParameter,
        getParameter: pc.Material.prototype.getParameter,
        getParameters: pc.Material.prototype.getParameters,
        clearParameters: pc.Material.prototype.clearParameters
    });

    var Command = function (layer, blendType, command) {
        this._key = [];
        this._key[pc.SORTKEY_FORWARD] = getKey(layer, blendType, true, 0);
        this.command = command;
    };

    Object.defineProperty(Command.prototype, 'key', {
        get: function () {
            return this._key[pc.SORTKEY_FORWARD];
        },
        set: function (val) {
            this._key[pc.SORTKEY_FORWARD] = val;
        }
    });

    var InstancingData = function (numObjects, dynamic, instanceSize) {
        instanceSize = instanceSize || 16;
        this.buffer = new Float32Array(numObjects * instanceSize);
        this.count = numObjects;
        this.offset = 0;
        this.usage = dynamic ? pc.BUFFER_DYNAMIC : pc.BUFFER_STATIC;
        this._buffer = null;
    };

    Object.assign(InstancingData.prototype, {
        update: function () {
            if (this._buffer) {
                this._buffer.setData(this.buffer);
            }
        }
    });

    function getKey(layer, blendType, isCommand, materialId) {
        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 27 - 30 : layer
        // 26      : translucency type (opaque/transparent)
        // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
        // 0 - 24  : Material ID (if oqaque) or 0 (if transparent - will be depth)
        return ((layer & 0x0f) << 27) |
               ((blendType === pc.BLEND_NONE ? 1 : 0) << 26) |
               ((isCommand ? 1 : 0) << 25) |
               ((materialId & 0x1ffffff) << 0);
    }

    return {
        Command: Command,
        Mesh: Mesh,
        MeshInstance: MeshInstance,
        InstancingData: InstancingData,
        _getDrawcallSortKey: getKey
    };
}());
