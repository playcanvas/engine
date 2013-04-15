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
            var i, j;
            var bonesToAdd = [];
            var bonesToAddCount = 0;
            var vertexCount = vertices.length;
            for (i = 0; i < vertexCount; i++) {
                for (var influence = 0; influence < 4; influence++) {
                    if (vertices[i].boneWeights[influence] > 0) {
                        var boneIndex = vertices[i].boneIndices[influence];  
                        var needToAdd = true;
                        for (j = 0; j < bonesToAddCount; j++) {
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
            for (i = 0; i < bonesToAddCount; i++) {
                this.boneIndices.push(bonesToAdd[i]);
            }
        
            // Add vertices and indices
            for (i = 0; i < vertexCount; i++) {
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

    function partitionSkin(boneLimit, vertexBuffers, indexBuffer, meshes, skin) {
        var i, j;
        var partition;
        var partitions = [];

        // Phase 1:  
        // Build the skin partitions
        var primitiveVertices = [];
        var primitiveIndices = [];

        var vbs = vertexBuffers;

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
        };

        // Go through index list and extract primitives and add them to bone partitions  
        // Since we are working with a single triangle list, everything is a triangle
        var basePartition = 0;

        var geomIndices = new Uint16Array(indexBuffer.lock());
        for (i = 0; i < meshes.length; i++) {
            var primitive = meshes[i].primitive[0];
            for (var iIndex = primitive.base; iIndex < primitive.base + primitive.count; ) {
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
                    partition = partitions[iBonePartition];
                    if (partition.addPrimitive(primitiveVertices, primitiveIndices, boneLimit)) {  
                        added = true;
                        break;
                    }
                }

                // If the primitive was not added to an existing bone partition, we need to make a new bone partition and add the primitive to it  
                if (!added) {
                    partition = new SkinPartition();
                    partition.material = meshes[i]._material;
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

        for (i = 0; i < partitions.length; i++) {
            partition = partitions[i];  
    
            if (partition.vertices.length && partition.indices.length) {
                // this bone partition contains vertices and indices  
    
                // Find offsets  
                var vertexStart = partitionedVertices.length;  
                var vertexCount = partition.vertices.length;  
                var indexStart = partitionedIndices.length;  
                var indexCount = partition.indices.length;  

                // Make a new sub set  
                partition.partition = i;
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
        // Build new vertex buffer from partitioned vertices
        var partitionedVbs = [];
        for (i = 0; i < vbs.length; i++) {
            var partitionedVb = new pc.gfx.VertexBuffer(vbs[i].getFormat(), partitionedVertices.length);
            var lockedBuffer = partitionedVb.lock();
            var byteArray = new Uint8Array(lockedBuffer);
            for (j = 0; j < partitionedVertices.length; j++) {
                byteArray.set(new Uint8Array(partitionedVertices[j].vertexData[i]), j * partitionedVb.getFormat().size);
            }
            partitionedVb.unlock();
            partitionedVbs.push(partitionedVb);
        }

        // Phase 4:
        // Build new index buffer from partitioned indices
        var indices = [];

        for (i = 0; i < partitions.length; i++) {
            partition = partitions[i];

            indices = indices.concat(partitionedIndices.splice(0, partition.indexCount));
        }

        var partitionedIb = new pc.gfx.IndexBuffer(pc.gfx.INDEXFORMAT_UINT16, indices.length);
        var idata = new Uint16Array(partitionedIb.lock());
        idata.set(indices);
        partitionedIb.unlock();

        // Phase 5:
        // Build new mesh array
        var partitionedMeshes = [];
        var base = 0;

        for (i = 0; i < partitions.length; i++) {
            partition = partitions[i];

            var ibp = [];
            var boneNames = [];
            for (j = 0; j < partition.boneIndices.length; j++) {
                ibp.push(skin.inverseBindPose[partition.boneIndices[j]]);
                boneNames.push(skin.boneNames[partition.boneIndices[j]]);
            }

            var partitionedSkin = new pc.scene.Skin(ibp, boneNames);

            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = partitionedVbs[0];
            mesh.indexBuffer[0] = partitionedIb;
            mesh.primitive[0].type = pc.gfx.PRIMITIVE_TRIANGLES;
            mesh.primitive[0].base = base;
            mesh.primitive[0].count = partition.indexCount;
            mesh.primitive[0].indexed = true;
            mesh.skin = partitionedSkin;
            mesh.aabb = meshes[0].aabb;

            mesh._material = partition.material;

            partitionedMeshes.push(mesh);

            base += partition.indexCount;
        }

        return partitionedMeshes;
    }
    
    return {
        partitionSkin: partitionSkin
    }; 
}());