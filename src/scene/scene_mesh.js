pc.extend(pc, function () {
    function getKey(layer, blendType, isCommand, materialId) {
        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 28 - 30 : layer
        // 26 - 27 : translucency type (opaque: 3, normal, additive, subtractive)
        // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
        // 0 - 24  : Material ID (if oqaque) or 0 (if transparent - will be depth)
        return ((layer & 0x7) << 28) |
               ((blendType & 0x3) << 26) |
               ((isCommand ? 1 : 0) << 25) |
               ((materialId & 0x1ffffff) << 0);
    }

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

    var InstancingData = function (numObjects, dynamic, instanceSize) {
        instanceSize = instanceSize || 16;
        this.buffer = new Float32Array(numObjects * instanceSize);
        this.count = numObjects;
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
     * var material = new pc.PhongMaterial();
     * var node = new pc.GraphNode();
     * var meshInstance = new pc.MeshInstance(node, mesh, material);
     * @property {pc.BoundingBox} aabb The world space axis-aligned bounding box for this
     * mesh instance.
     * @property {Boolean} castShadow Controls whether the mesh instances casts shadows.
     * Defaults to false.
     * @property {Number} layer The layer used by this mesh instance. Can be:
     * <ul>
     *     <li>pc.LAYER_WORLD</li>
     *     <li>pc.LAYER_FX</li>
     *     <li>pc.LAYER_GIZMO</li>
     *     <li>pc.LAYER_HUD</li>
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
     */
    var MeshInstance = function MeshInstance(node, mesh, material) {
        this.node = node;           // The node that defines the transform of the mesh instance
        this.mesh = mesh;           // The mesh that this instance renders
        this.material = material;   // The material with which to render this instance

        this._shader = null;
        this._shaderDefs = 256; // 1 byte toggles, 3 bytes light mask; Default value is no toggles and mask = 1
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv0? pc.SHADERDEF_UV0 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasUv1? pc.SHADERDEF_UV1 : 0;
        this._shaderDefs |= mesh.vertexBuffer.format.hasColor? pc.SHADERDEF_VCOLOR : 0;

        // Render options
        this.layer = pc.LAYER_WORLD;
        this.renderStyle = pc.RENDERSTYLE_SOLID;
        this.castShadow = false;
        this._receiveShadow = true;
        this.drawToDepth = true;
        this.cull = true;
        this.pick = true;

        // 64-bit integer key that defines render order of this mesh instance
        this.key = 0;
        this.updateKey();

        this._skinInstance = null;

        // World space AABB
        this.aabb = new pc.BoundingBox();
        this.normalMatrix = new pc.Mat3();

        this._boneAabb = null;

        this.parameters = {};
    };

    Object.defineProperty(MeshInstance.prototype, 'aabb', {
        get: function () {
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
                }
                // Update full instance AABB
                var first = true;
                for(i=0; i<this.mesh.boneAabb.length; i++) {
                    if (!boneUsed[i]) continue;
                    if (first) {
                        this._aabb.center.copy(this._boneAabb[0].center);
                        this._aabb.halfExtents.copy(this._boneAabb[0].halfExtents);
                        first = false;
                    } else {
                        this._aabb.add(this._boneAabb[i]);
                    }
                }
            } else {
                this._aabb.setFromTransformedAabb(this.mesh.aabb, this.node.worldTransform);
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
            this._shader = null;
            // Remove the material's reference to this mesh instance
            if (this._material) {
                var meshInstances = this._material.meshInstances;
                var index = meshInstances.indexOf(this);
                if (index !== -1) {
                    meshInstances.splice(index, 1);
                }
            }

            this._material = material;

            // Record that the material is referenced by this mesh instance
            this._material.meshInstances.push(this);

            this.updateKey();
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
            this._shader = null;
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'skinInstance', {
        get: function () {
            return this._skinInstance;
        },
        set: function (val) {
            this._skinInstance = val;
            this._shaderDefs = val? (this._shaderDefs | pc.SHADERDEF_SKIN) : (this._shaderDefs & ~pc.SHADERDEF_SKIN);
            this._shader = null;
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
            return this._shaderDefs >> 8;
        },
        set: function (val) {
            var toggles = this._shaderDefs & 0x000000FF;
            this._shaderDefs = toggles | (val << 8);
            this._shader = null;
        }
    });

    pc.extend(MeshInstance.prototype, {
        syncAabb: function () {
            // Deprecated
        },

        updateKey: function () {
            var material = this.material;
            this.key = getKey(this.layer, material.blendType, false, material.id);
        },

        setParameter : pc.Material.prototype.setParameter,
        setParameters : pc.Material.prototype.setParameters,
        deleteParameter : pc.Material.prototype.deleteParameter,
        getParameter : pc.Material.prototype.getParameter,
        getParameters : pc.Material.prototype.getParameters,
        clearParameters : pc.Material.prototype.clearParameters
    });

    var Command = function (layer, blendType, command) {
        this.key = getKey(layer, blendType, true, 0);
        this.command = command;
    };

    return {
        Command: Command,
        Mesh: Mesh,
        MeshInstance: MeshInstance,
        InstancingData: InstancingData,
        _getDrawcallSortKey: getKey
    };
}());
