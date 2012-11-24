pc.extend(pc.scene, function () {

    function PartitionedVertex() {
        this.vertexData = [];
        this.boneWeights = [];
        this.boneIndices = [];
    }
    
    function SkinPartition() {
        this.partition = 0;
        this.vertexStart = 0;
        this.vertexCount = 0;
        this.indexStart = 0;
        this.indexCount = 0;

        // Indices of bones in this partition. skin matrices will be uploaded to the vertex shader in this order.
        this.boneIndices = []; 
        
        this.vertices = []; // Partitioned vertex attributes
        this.indices = [];  // Partitioned vertex indices
        this.indexMap = {}; // Maps the index of an un-partitioned vertex to that same vertex if it has been added
                            // to this particular partition. speeds up checking for duplicate vertices so we don't
                            // add the same vertex more than once.  
    }

    SkinPartition.prototype = {
        addVertex: function (vertex, index) {
            var remappedIndex = -1;
            if (this.indexMap[index] !== undefined) {
                remappedIndex = this.indexMap[index];
                this.indices.push(remappedIndex);
            } else {
                // Create new partitioned vertex
                for (var influence = 0; influence < 4; influence++ ) {
                    if (vertex.boneWeights[influence] === 0)
                        continue;  
        
                    vertex.boneIndices[influence] = this.getBoneRemap(vertex.boneIndices[influence]);
                }  
                remappedIndex = this.vertices.length;
                this.indices.push(remappedIndex);  
                this.vertices.push(vertex);
                this.indexMap[index] = remappedIndex;
            }
        },

        addPrimitive: function (vertices, vertexIndices, boneLimit) {
            // Build a list of all the bones used by the vertex that aren't currently in this partition  
            var bonesToAdd = [];
            var bonesToAddCount = 0;
            var vertexCount = vertices.length;
            for (var i = 0; i < vertexCount; i++) {
                for (var influence = 0; influence < 4; influence++) {
                    if (vertices[i].boneWeights[influence] > 0) {
                        var boneIndex = vertices[i].boneIndices[influence];  
                        var needToAdd = true;
                        for (var j = 0; j < bonesToAddCount; j++) {
                            if (bonesToAdd[j] == boneIndex) {
                                needToAdd = false;
                                break;
                            }  
                        }
                        if (needToAdd) {
                            bonesToAdd[bonesToAddCount] = boneIndex;  
                            var boneRemap = this.getBoneRemap(boneIndex);  
                            bonesToAddCount += (boneRemap === -1 ? 1 : 0);
                        }  
                    }  
                }  
            }  
           
            // Check that we can fit more bones in this partition.  
            if ((this.boneIndices.length + bonesToAddCount) > boneLimit) {
                return false;  
            }  
        
            // Add bones  
            for (var i = 0; i < bonesToAddCount; i++) {
                this.boneIndices.push(bonesToAdd[i]);
            }
        
            // Add vertices and indices
            for (var i = 0; i < vertexCount; i++) {
                this.addVertex(vertices[i], vertexIndices[i]);  
            }
        
            return true;
        },

        getBoneRemap: function (boneIndex) {
            for (var i = 0; i < this.boneIndices.length; i++ ) {
                if (this.boneIndices[i] === boneIndex) {
                    return i;
                }  
            }  
            return -1;  
        }
    };


    /**
     * @name pc.scene.Geometry
     * @class A geometry.
     */
    var Geometry = function Geometry() {
        this._vertexBuffers = []; // A geometry can have multiple vertex buffers/streams
        this._indexBuffers = []; // A geometry can have multiple index buffers (1 per style)
        this._submeshes = [
            [], // Normal render style
            []  // Wireframe render style
        ];

        // Skinning data
        this._inverseBindPose = null;
        this._matrixPalette = null; // The raw memory buffer to hold the matrix palette
        this._matrixPaletteF32 = null; // The matrix palette uploaded to the shader (typed as Float32Array)
        this._matrixPaletteEntryF32 = null; // The memory buffer represented as an array of matrices to use with the pc.math.mat4 API

        // Object space bounding volume
        this._aabb = null;
        this._volume = null;

        var device = pc.gfx.Device.getCurrent();
        var scope = device.scope;
        this.matrixModelId = scope.resolve("matrix_model");
        this.poseId = scope.resolve("matrix_pose[0]"); 
    };

    Geometry.prototype = {
    
        /**
         * @function
         * @name pc.scene.Geometry#dispatch
         * @description Submits a geometry for rendering.
         * @param {Array} transform A 4x4 world transformation matrix.
         * @param {pc.scene.RenderStyle} style (Optional) The render style of the geometry.
         * @author Will Eastcott
         */
        dispatch: function (transform, style) {
            style = style || 0; // Default to normal render style

            var i, j, numVertBuffers, numSubmeshes, numBoneIndices, material;
            var device = pc.gfx.Device.getCurrent();

            // Set the vertex and index buffers
            for (i = 0, numVertBuffers = this._vertexBuffers.length; i < numVertBuffers; i++) {
                device.setVertexBuffer(this._vertexBuffers[i], i);
            }
            device.setIndexBuffer(this._indexBuffers[style]);

            // Generate the matrix palette
            var skinned = this.isSkinned();
            if (skinned) {
                if (!this._partitionedBoneIndices) {
                    this.poseId.setValue(this._matrixPaletteF32);
                }
            }

            this.matrixModelId.setValue(transform);

            // Dispatch each submesh
            var submeshes = this._submeshes[style];
            for (i = 0, numSubmeshes = submeshes.length; i < numSubmeshes; i++) {
                var submesh = submeshes[i];

                // Set the skinning matrix palette
                if (skinned && this._partitionedBoneIndices) {
                    var boneIndices = this._partitionedBoneIndices[i];
                    var palette = this._partitionedPalettes[i];
                    for (j = 0; j < boneIndices.length; j++) {
                        palette.set(this._matrixPaletteEntryF32[boneIndices[j]], j * 16);
                    }
                    this.poseId.setValue(palette);
                }

                // Set all state related to the material
                var material = submesh.material;
                material.setParameters();
                device.updateLocalState(material.getState());
                device.setProgram(material.getProgram(pc.scene.MeshNode._current));

                // Now draw the submesh
                device.draw(submesh.primitive);

                // Pop the submesh's local state
                device.clearLocalState();
            }
        },

        /**
         * @function
         * @name pc.scene.Geometry#getVertexBuffers
         * @description Retrieves the geometry's vertex buffer array.
         * @returns {Array} The geometry's vertex buffer array.
         * @author Will Eastcott
         */
        getVertexBuffers: function () {
            return this._vertexBuffers;
        },

        /**
         * @function
         * @name pc.scene.Geometry#setVertexBuffers
         * @description Assigns an array of pc.gfx.VertexBuffer objects to the specified geometry.
         * @param {Array} buffers An array of pc.gfx.VertexBuffer objects.
         * @author Will Eastcott
         */
        setVertexBuffers: function (buffers) {
            this._vertexBuffers = buffers;
        },

        /**
         * @function
         * @name pc.scene.Geometry#getIndexBuffer
         * @description Returns the index buffer assigned to the geometry. The index buffer indexes
         * into the parent geometry's vertex buffer(s).
         * @returns {pc.gfx.IndexBuffer} The index buffer assigned to the geometry.
         * @author Will Eastcott
         */
        getIndexBuffer: function (style) {
            style = style || 0; // Default to querying normal style index buffer
            return this._indexBuffers[style];
        },

        /**
         * @function
         * @name pc.scene.Geometry#setIndexBuffer
         * @description Assigns an index buffer to the specified geometry. The index buffer indexes
         * into the parent geometry's vertex buffer(s).
         * @param {pc.gfx.IndexBuffer} indexBuffer The index buffer to assign to the geometry.
         * @author Will Eastcott
         */
        setIndexBuffer: function (indexBuffer, style) {
            style = style || 0; // Default to setting normal style index buffer
            this._indexBuffers[style] = indexBuffer;
        },

        /**
         * @function
         * @name pc.scene.Geometry#getSubMeshes
         * @description Retrieves the geometry's array of submeshes.
         * @returns {Array} The geometry's submesh array.
         * @author Will Eastcott
         */
        getSubMeshes: function (style) {
            style = style || 0; // Default to querying normal style index buffer
            return this._submeshes[style];
        },

        /**
         * @function
         * @name pc.scene.Geometry#setSubMeshes
         * @description Assigns an array of pc.scene.SubMesh objects to the specified geometry.
         * @param {Array} submeshes An array of pc.scene.SubMesh objects.
         * @author Will Eastcott
         */
        setSubMeshes: function (submeshes, style) {
            style = style || 0; // Default to setting normal style submeshes
            this._submeshes[style] = submeshes;
        },

        /**
         * @function
         * @name pc.scene.Geometry#getInverseBindPose
         * @description Retrieves the geometry's array of inverse bind pose matrices.
         * @returns {Array} The geometry's inverse bind pose matrix array.
         * @author Will Eastcott
         */
        getInverseBindPose: function () {
            return this._inverseBindPose;
        },

        getMatrixPalette: function () {
            return this._matrixPaletteEntryF32;
        },

        /**
         * @function
         * @name pc.scene.Geometry#isSkinned
         * @description Returns true if geometry is skinned.
         * @returns {Boolean} True if geometry is skinned
         * @author Will Eastcott
         */
        isSkinned: function () {
            return (this._inverseBindPose !== null);
        },

        /**
         * @function
         * @name pc.scene.Geometry#setInverseBindPose
         * @description Assigns an array of inverse bind pose matrices to the specified geometry.
         * @param {Array} buffers An array of objects (pc.gfx.Mat4).
         * @author Will Eastcott
         */
        setInverseBindPose: function (ibp) {
            this._inverseBindPose = ibp;

            if (ibp) {
                // Create a matrix array that will be a concatenation of the IBMs and the WTMs at each node
                this._matrixPalette         = new ArrayBuffer(ibp.length * 16 * 4);
                this._matrixPaletteF32      = new Float32Array(this._matrixPalette);
                this._matrixPaletteEntryF32 = [];
                for (var i = 0, len = ibp.length; i < len; i++) {
                    this._matrixPaletteEntryF32[i] = new Float32Array(this._matrixPalette, i * 16 * 4, 16);
                }
            } else {
                this._matrixPalette = null;
                this._matrixPalette = null;
                this._matrixPaletteF32 = null;
                this._matrixPaletteEntryF32 = null;
            }
        },

        /**
         * @function
         * @name pc.scene.Geometry#getAabb
         * @description Retrieves the pc.shape.Aabb object assigned to the geometry which acts as
         * the geometry's bounding volume.
         * @returns {pc.shape.Aabb} The geometry's axis-aligned bounding box volume.
         * @author Will Eastcott
         */
        getAabb: function () {
            return this._aabb;
        },

        /**
         * @function
         * @name pc.scene.Geometry#setAabb
         * @description Assigns a pc.shape.Aabb volume object to the specified geometry.
         * @param {pc.shape.Aabb} volume The bounding volume to assign to the geometry.
         * @author Will Eastcott
         */
        setAabb: function (aabb) {
            this._aabb = aabb;
        },

        /**
         * @function
         * @name pc.scene.Geometry#getVolume
         * @description Retrieves the pc.shape.Sphere object assigned to the geometry which acts as
         * the geometry's bounding volume.
         * @returns {pc.shape.Sphere} The geometry's bounding sphere volume.
         * @author Will Eastcott
         */
        getVolume: function () {
            return this._volume;
        },

        /**
         * @function
         * @name pc.scene.Geometry#setVolume
         * @description Assigns a pc.shape.Sphere volume object to the specified geometry.
         * @param {pc.shape.Sphere} volume The bounding volume to assign to the geometry.
         * @author Will Eastcott
         */
        setVolume: function (volume) {
            this._volume = volume;
        },

        /**
         * @function
         * @name pc.scene.Geometry#hasAlpha
         * @description
         * @returns {Boolean}
         * @author Will Eastcott
         */
        hasAlpha: function () {
            var submeshes = this.getSubMeshes();
            for (var i = 0; i < submeshes.length; i++) {
                var material = submeshes[i].material;
                if (material.transparent)
                    return true;
            }
            return false;
        },

        /**
         * @function
         * @name pc.scene.Geometry#generateWireframe
         * @description Augments the specified geometry with the data required to render it in wireframe mode.
         * @author Will Eastcott
         */
        generateWireframe: function () {
            var i, i1, i2, submesh, base, count;

            var indexBuffer = this.getIndexBuffer(pc.scene.RenderStyle.NORMAL);
            var submeshes = this.getSubMeshes(pc.scene.RenderStyle.NORMAL);

            var srcIndices = new Uint16Array(indexBuffer.lock());
            var wireIndices = [];

            var offsets = [[0, 1], [1, 2], [2, 0]];
            for (i = 0; i < submeshes.length; i++) {
                submesh = submeshes[i];

                base = submesh.primitive.base;
                count = submesh.primitive.count;

                var uniqueLineIndices = {};
                var lines = [];
                for (j = base; j < base + count; j+=3) {
                    for (var k = 0; k < 3; k++) {
                        i1 = srcIndices[j + offsets[k][0]];
                        i2 = srcIndices[j + offsets[k][1]];
                        var line = (i1 > i2) ? ((i2 << 16) | i1) : ((i1 << 16) | i2);
                        if (uniqueLineIndices[line] === undefined) {
                            uniqueLineIndices[line] = 0;
                            lines.push(i1, i2);
                        }
                    }
                }

                wireIndices.push(lines);
            }
            indexBuffer.unlock();

            var numIndices = 0;
            for (i = 0; i < wireIndices.length; i++) {
                numIndices += wireIndices[i].length;
            }

            var wireBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, numIndices);
            // Copy indices into index buffer
            var dstIndices = new Uint16Array(wireBuffer.lock());
            var index = 0;
            for (i = 0; i < wireIndices.length; i++) {
                var wireSubmesh = wireIndices[i];
                for (j = 0; j < wireSubmesh.length; j++) {
                    dstIndices[index++] = wireSubmesh[j];
                }
            }
            wireBuffer.unlock();

            // Generate a set of wireframe submeshes
            var wireSubmeshes = [];
            base = 0;
            for (i = 0; i < submeshes.length; i++) {
                submesh = submeshes[i];
                wireSubmeshes.push({
                    material: submesh.material,
                    primitive: {
                        type: pc.gfx.PrimType.LINES,
                        base: base,
                        count: wireIndices[i].length,
                        indexed: true
                    }
                });
                base += wireIndices[i].length;
            }

            this.setIndexBuffer(wireBuffer, pc.scene.RenderStyle.WIREFRAME);
            this.setSubMeshes(wireSubmeshes, pc.scene.RenderStyle.WIREFRAME);
        },

        partitionSkin: function (boneLimit) {
            var partitions = [];

            // Phase 1:  
            // Build the skin partitions
            var primitiveVertices = [];
            var primitiveIndices = [];

            var vbs = this.getVertexBuffers();

            var getVertex = function (idx) {
                var vert = new PartitionedVertex();
                for (var i = 0; i < vbs.length; i++) {
                    var bufferData = vbs[i].lock();
                    var format = vbs[i].getFormat();
                    var stride = format.size;
                    vert.vertexData.push(bufferData.slice(idx * stride, idx * stride + stride));
                    // Not doing an unlock because we're reading....but yeah, it's naughty

                    for (var j = 0; j < format.elements.length; j++) {
                        if (format.elements[j].scopeId.name === 'vertex_boneIndices') {
                            vert.boneIndices = new Uint8Array(vert.vertexData[i], format.elements[j].offset, 4);
                        }
                        if (format.elements[j].scopeId.name === 'vertex_boneWeights') {
                            vert.boneWeights = new Float32Array(vert.vertexData[i], format.elements[j].offset, 4);
                        }
                    }
                }
                return vert;
            }

            // Go through index list and extract primitives and add them to bone partitions  
            // Since we are working with a single triangle list, everything is a triangle
            var basePartition = 0;

            var geomIndices = new Uint16Array(this.getIndexBuffer(pc.scene.RenderStyle.NORMAL).lock());
            var subMeshes = this.getSubMeshes(pc.scene.RenderStyle.NORMAL);
            for (var iSubMesh = 0; iSubMesh < subMeshes.length; iSubMesh++) {
                var submesh = subMeshes[iSubMesh];
                for (var iIndex = submesh.primitive.base; iIndex < submesh.primitive.base + submesh.primitive.count; ) {  
                    // Extact primitive  
                    // Convert vertices  
                    // There is a little bit of wasted time here if the vertex was already added previously  
                    var index;  

                    index = geomIndices[iIndex++];
                    primitiveVertices[0] = getVertex(index);
                    primitiveIndices[0] = index;

                    index = geomIndices[iIndex++];
                    primitiveVertices[1] = getVertex(index);
                    primitiveIndices[1] = index; 

                    index = geomIndices[iIndex++];
                    primitiveVertices[2] = getVertex(index);
                    primitiveIndices[2] = index;  

                    // Attempt to add the primitive to an existing bone partition  
                    var added = false;
                    for (var iBonePartition = basePartition; iBonePartition < partitions.length; iBonePartition++) {
                        var partition = partitions[iBonePartition];  
                        if (partition.addPrimitive(primitiveVertices, primitiveIndices, boneLimit)) {  
                            added = true;
                            break;
                        }
                    }

                    // If the primitive was not added to an existing bone partition, we need to make a new bone partition and add the primitive to it  
                    if (!added) {
                        var partition = new SkinPartition();
                        partition.material = submesh.material;
                        partition.addPrimitive(primitiveVertices, primitiveIndices, boneLimit);  
                        partitions.push(partition);
                    }
                }  

                basePartition = partitions.length;
            }

            // Phase 2:
            // Gather vertex and index lists from all the partitions, then upload to GPU  
            var partitionedVertices = [];
            var partitionedIndices = [];

            for (var iPartition = 0; iPartition < partitions.length; iPartition++) {
                var partition = partitions[iPartition];  
        
                if (partition.vertices.length && partition.indices.length) {
                    // this bone partition contains vertices and indices  
        
                    // Find offsets  
                    var vertexStart = partitionedVertices.length;  
                    var vertexCount = partition.vertices.length;  
                    var indexStart = partitionedIndices.length;  
                    var indexCount = partition.indices.length;  

                    // Make a new sub set  
                    partition.partition = iPartition;  
                    partition.vertexStart = vertexStart;  
                    partition.vertexCount = vertexCount;  
                    partition.indexStart = indexStart;  
                    partition.indexCount = indexCount;  

                    // Copy buffers  
                    var iSour;  
                    var iDest;  

                    // Copy vertices to final list  
                    iSour = 0;  
                    iDest = vertexStart;
                    while (iSour < vertexCount) {
                        partitionedVertices[iDest++] = partition.vertices[iSour++];  
                    }
        
                    // Copy indices to final list  
                    iSour = 0;  
                    iDest = indexStart;
                    while (iSour < indexCount) {
                        partitionedIndices[iDest++] = partition.indices[iSour++] + vertexStart;    // adjust so they reference into flat vertex list  
                    }
                }  
            }

            // Phase 3:
            // Built new vertex buffer from partitioned vertices
            var vertexBuffers = [];
            for (var i = 0; i < vbs.length; i++) {
                var vertexBuffer = new pc.gfx.VertexBuffer(vbs[i].getFormat(), partitionedVertices.length, pc.gfx.VertexBufferUsage.STATIC);
                var lockedBuffer = vertexBuffer.lock();
                var byteArray = new Uint8Array(lockedBuffer);
                for (var j = 0; j < partitionedVertices.length; j++) {
                    byteArray.set(new Uint8Array(partitionedVertices[j].vertexData[i]), j * vertexBuffer.getFormat().size);
                }
                vertexBuffer.unlock();
                vertexBuffers.push(vertexBuffer);
            }

            // Phase 3:
            // Built new index buffer and submesh array from partitioned indices
            var subMeshes = [];
            var indices = [];
            this._partitionedBoneIndices = [];
            for (var iPartition = 0; iPartition < partitions.length; iPartition++) {
                var partition = partitions[iPartition];
                var subMesh = {
                    material: partition.material,
                    primitive: {
                        type: pc.gfx.PrimType.TRIANGLES,
                        base: indices.length,
                        count: partition.indexCount,
                        indexed: true
                    }
                };

                subMeshes.push(subMesh);

                this._partitionedBoneIndices.push(partition.boneIndices);

                indices = indices.concat(partitionedIndices.splice(0, partition.indexCount));
            }

            var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, indices.length);
            var idata = new Uint16Array(indexBuffer.lock());
            idata.set(indices);
            indexBuffer.unlock();

            this.setVertexBuffers(vertexBuffers);
            this.setIndexBuffer(indexBuffer, pc.scene.RenderStyle.NORMAL);
            this.setSubMeshes(subMeshes, pc.scene.RenderStyle.NORMAL);

            // Allocate the partitioned matrix palettes
            this._partitionedPalettes = [];
            for (var i = 0; i < this._partitionedBoneIndices.length; i++) {
                this._partitionedPalettes.push(new Float32Array(this._partitionedBoneIndices[i].length * 16));
            }
        }
    }
    
    return {
        Geometry: Geometry
    }; 
}());