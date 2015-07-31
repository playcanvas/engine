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
     * @class A graphical primitive.
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
        this.aabb = new pc.shape.Aabb();

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
     * @class A instance of a pc.Mesh. A single mesh can be referenced by many instances
     * that can have different transforms and materials.
     * @param {pc.GraphNode} node The graph node defining the transform for this instance.
     * @param {pc.Mesh} mesh The graphics mesh being instanced.
     * @param {pc.Material} material The material used to render this instance.
     *
     * @property {pc.Material} material The material used by this pc.MeshInstance.
     * @property {Number} layer The layer used by this pc.MeshInstance.
     */
    var MeshInstance = function MeshInstance(node, mesh, material) {
        this.node = node;           // The node that defines the transform of the mesh instance
        this.mesh = mesh;           // The mesh that this instance renders
        this.material = material;   // The material with which to render this instance

        this._shader = null;
        this._shaderDefs = 256; // 1 byte toggles, 3 bytes light mask; Default value is no toggles and mask = 1
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
        this.aabb = new pc.shape.Aabb();
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
                    var elems = this.mesh.vertexBuffer.format.elements;
                    var numVerts = this.mesh.vertexBuffer.numVertices;
                    var vertSize = this.mesh.vertexBuffer.format.size;
                    var data = new DataView(this.mesh.vertexBuffer.storage);
                    var boneVerts;
                    var index;
                    var offsetP, offsetI;
                    var j, k;
                    for(i=0; i<elems.length; i++) {
                        if (elems[i].name===pc.SEMANTIC_POSITION) {
                            offsetP = elems[i].offset;
                        } else if (elems[i].name===pc.SEMANTIC_BLENDINDICES) {
                            offsetI = elems[i].offset;
                        }
                    }
                    for(i=0; i<numBones; i++) {
                        boneVerts = [];
                        for(j=0; j<numVerts; j++) {
                            for(k=0; k<4; k++) {
                                index = data.getUint8(j * vertSize + offsetI + k, true);
                                if (index===i) {
                                    // Vertex j is affected by bone i
                                    boneVerts.push( data.getFloat32(j * vertSize + offsetP, true) );
                                    boneVerts.push( data.getFloat32(j * vertSize + offsetP + 4, true) );
                                    boneVerts.push( data.getFloat32(j * vertSize + offsetP + 8, true) );
                                }
                            }
                        }
                        this.mesh.boneAabb.push(new pc.shape.Aabb());
                        this.mesh.boneAabb[i].compute(boneVerts);
                    }
                }
                // Initialize per-instance AABBs if needed
                if (!this._boneAabb) {
                    this._boneAabb = [];
                    for(i=0; i<this.mesh.boneAabb.length; i++) {
                        this._boneAabb[i] = new pc.shape.Aabb();
                    }
                }
                // Update per-instance bone AABBs
                for(i=0; i<this.mesh.boneAabb.length; i++) {
                    this._boneAabb[i].setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);
                }
                // Update full instance AABB
                this._aabb.center.copy(this._boneAabb[0].center);
                this._aabb.halfExtents.copy(this._boneAabb[0].halfExtents);
                for(i=0; i<this.mesh.boneAabb.length; i++) {
                    this._aabb.add(this._boneAabb[i]);
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
