pc.extend(pc, function () {
    var id = 0;

    /**
     * @name pc.Mesh
     * @class A graphical primitive. The mesh is defined by a {@link pc.VertexBuffer} and an optional
     * {@link pc.IndexBuffer}. It also contains a primitive definition which controls the type of the
     * primitive and the portion of the vertex or index buffer to use.
     * @description Create a new mesh.
     * @property {pc.VertexBuffer} vertexBuffer The vertex buffer holding the vertex data of the mesh.
     * @property {pc.IndexBuffer[]} indexBuffer An array of index buffers. For unindexed meshes, this array can
     * be empty. The first index buffer in the array is used by {@link pc.MeshInstance}s with a renderStyle
     * property set to pc.RENDERSTYLE_SOLID. The second index buffer in the array is used if renderStyle is
     * set to pc.RENDERSTYLE_WIREFRAME.
     * @property {Object[]} primitive Array of primitive objects defining how vertex (and index) data in the
     * mesh should be interpreted by the graphics device. For details on the primitive object, see
     * {@link pc.GraphicsDevice#draw}. The primitive is ordered based on render style like the indexBuffer property.
     * @property {pc.BoundingBox} aabb The axis-aligned bounding box for the object space vertices of this mesh.
     */
    var Mesh = function () {
        this._refCount = 0;
        this.id = id++;
        this.vertexBuffer = null;
        this.indexBuffer = [ null ];
        this.primitive = [{
            type: 0,
            base: 0,
            count: 0
        }];
        this.skin = null;

        // AABB for object space mesh vertices
        this.aabb = new pc.BoundingBox();

        // Array of object space AABBs of vertices affected by each bone
        this.boneAabb = null;
    };

    /**
     * @name pc.MeshInstance
     * @class An instance of a {@link pc.Mesh}. A single mesh can be referenced by many
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
     * @property {Boolean} castShadow Controls whether the mesh instance casts shadows.
     * Defaults to false.
     * @property {Boolean} visible Enable rendering for this mesh instance. Use visible property to enable/disable rendering without overhead of removing from scene.
     * But note that the mesh instance is still in the hierarchy and still in the draw call list.
     * @property {Number} layer The layer used by this mesh instance. Layers define drawing order. Can be:
     * <ul>
     *     <li>pc.LAYER_WORLD or 15</li>
     *     <li>pc.LAYER_FX or 2</li>
     *     <li>pc.LAYER_GIZMO or 1</li>
     *     <li>pc.LAYER_HUD or 0</li>
     *     <li>Any number between 3 and 14 can be used as a custom layer.</li>
     * </ul>
     * Defaults to pc.LAYER_WORLD.
     * @property {pc.Material} material The material used by this mesh instance.
     * @property {Number} renderStyle The render style of the mesh instance. Can be:
     * <ul>
     *     <li>pc.RENDERSTYLE_SOLID</li>
     *     <li>pc.RENDERSTYLE_WIREFRAME</li>
     *     <li>pc.RENDERSTYLE_POINTS</li>
     * </ul>
     * Defaults to pc.RENDERSTYLE_SOLID.
     * @property {Boolean} cull Controls whether the mesh instance can be culled with frustum culling
     */
    var MeshInstance = function MeshInstance(node, mesh, material) {
        this._key = [0,0];
        this._shader = [null, null, null];

        this.isStatic = false;
        this._staticLightList = null;
        this._staticSource = null;

        this.node = node;           // The node that defines the transform of the mesh instance
        this._mesh = mesh;           // The mesh that this instance renders
        mesh._refCount++;
        this.material = material;   // The material with which to render this instance

        this._shaderDefs = (1<<16); // 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = 1
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? pc.SHADERDEF_UV0 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? pc.SHADERDEF_UV1 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? pc.SHADERDEF_VCOLOR : 0;

        // Render options
        this.visible = true;
        this.layer = pc.LAYER_WORLD;
        this.renderStyle = pc.RENDERSTYLE_SOLID;
        this.castShadow = false;
        this._receiveShadow = true;
        this._screenSpace = false;
        this.drawToDepth = true;
        this.cull = true;
        this.pick = true;
        this._updateAabb = true;

        // 64-bit integer key that defines render order of this mesh instance
        this.updateKey();

        this._skinInstance = null;
        this.instancingData = null;

        // World space AABB
        this.aabb = new pc.BoundingBox();

        this._boneAabb = null;
        this._aabbVer = -1;

        this.parameters = {};
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

            if (!this._updateAabb) return this._aabb;

            if (this.skinInstance) {
                var numBones = this.mesh.skin.boneNames.length;
                var i;
                // Initialize local bone AABBs if needed
                if (!this.mesh.boneAabb) {

                    this.mesh.boneAabb = [];
                    this.mesh.boneUsed = [];
                    var elems = this.mesh.vertexBuffer.format.elements;
                    var numVerts = this.mesh.vertexBuffer.numVertices;
                    var vertSize = this.mesh.vertexBuffer.format.size;
                    var index;
                    var offsetP, offsetI, offsetW;
                    var j, k;
                    for(i=0; i<elems.length; i++) {
                        if (elems[i].name===pc.SEMANTIC_POSITION) {
                            offsetP = elems[i].offset;
                        } else if (elems[i].name===pc.SEMANTIC_BLENDINDICES) {
                            offsetI = elems[i].offset;
                        } else if (elems[i].name===pc.SEMANTIC_BLENDWEIGHT) {
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
                    var boneUsed = this.mesh.boneUsed;

                    for(i=0; i<numBones; i++) {
                        boneMin[i] = new pc.Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                        boneMax[i] = new pc.Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
                    }

                    for(j=0; j<numVerts; j++) {
                        for(k=0; k<4; k++) {
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

                    var aabb;
                    for(i=0; i<numBones; i++) {
                        aabb = new pc.BoundingBox();
                        aabb.setMinMax(boneMin[i], boneMax[i]);
                        this.mesh.boneAabb.push(aabb);
                    }
                }

                // Initialize per-instance AABBs if needed
                if (!this._boneAabb) {
                    this._boneAabb = [];
                    for(i=0; i<this.mesh.boneAabb.length; i++) {
                        this._boneAabb[i] = new pc.BoundingBox();
                    }
                }

                var boneUsed = this.mesh.boneUsed;

                // Update per-instance bone AABBs
                for(i=0; i<this.mesh.boneAabb.length; i++) {
                    if (!boneUsed[i]) continue;
                    this._boneAabb[i].setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);
                    this._boneAabb[i].center.add(this.skinInstance.rootNode.getPosition());
                }
                // Update full instance AABB
                var first = true;
                for(i=0; i<this.mesh.boneAabb.length; i++) {
                    if (!boneUsed[i]) continue;
                    if (first) {
                        this._aabb.center.copy(this._boneAabb[i].center);
                        this._aabb.halfExtents.copy(this._boneAabb[i].halfExtents);
                        first = false;
                    } else {
                        this._aabb.add(this._boneAabb[i]);
                    }
                }
            } else if (this.node._aabbVer!==this._aabbVer) {
                this._aabb.setFromTransformedAabb(this.mesh.aabb, this.node.getWorldTransform());
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
            for(i=0; i<this._shader.length; i++) {
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

            this._material = material;

            if (this._material) {
                // Record that the material is referenced by this mesh instance
                this._material.meshInstances.push(this);

                this.updateKey();
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
            this._shaderDefs = val? (this._shaderDefs & ~pc.SHADERDEF_NOSHADOW) : (this._shaderDefs | pc.SHADERDEF_NOSHADOW);
            this._shader[pc.SHADER_FORWARD] = null;
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'skinInstance', {
        get: function () {
            return this._skinInstance;
        },
        set: function (val) {
            this._skinInstance = val;
            this._shaderDefs = val? (this._shaderDefs | pc.SHADERDEF_SKIN) : (this._shaderDefs & ~pc.SHADERDEF_SKIN);
            for(var i=0; i<this._shader.length; i++) {
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
     * @type Number
     * @description Mask controlling which {@link pc.LightComponent}s light this mesh instance.
     * To ignore all dynamic lights, set mask to 0. Defaults to 1.
     */
    Object.defineProperty(MeshInstance.prototype, 'mask', {
        get: function () {
            return this._shaderDefs >> 16;
        },
        set: function (val) {
            var toggles = this._shaderDefs & 0x0000FFFF;
            this._shaderDefs = toggles | (val << 16);
            this._shader[pc.SHADER_FORWARD] = null;
        }
    });

    pc.extend(MeshInstance.prototype, {
        syncAabb: function () {
            // Deprecated
        },

        updateKey: function () {
            var material = this.material;
            this._key[pc.SORTKEY_FORWARD] = getKey(this.layer,
                (material.alphaToCoverage || material.alphaTest) ? pc.BLEND_NORMAL : material.blendType, // render alphatest/atoc after opaque
                false, material.id);
        },

        setParameter : pc.Material.prototype.setParameter,
        setParameters : pc.Material.prototype.setParameters,
        deleteParameter : pc.Material.prototype.deleteParameter,
        getParameter : pc.Material.prototype.getParameter,
        getParameters : pc.Material.prototype.getParameters,
        clearParameters : pc.Material.prototype.clearParameters
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
        this.usage = dynamic? pc.BUFFER_DYNAMIC : pc.BUFFER_STATIC;
        this._buffer = null;
    };

    InstancingData.prototype = {
        update: function () {
            if (this._buffer) {
                this._buffer.setData(this.buffer);
            }
        }
    };

    function getKey(layer, blendType, isCommand, materialId) {
        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 27 - 30 : layer
        // 26      : translucency type (opaque/transparent)
        // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
        // 0 - 24  : Material ID (if oqaque) or 0 (if transparent - will be depth)
        return ((layer & 0x0f) << 27) |
               ((blendType===pc.BLEND_NONE? 1 : 0) << 26) |
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
