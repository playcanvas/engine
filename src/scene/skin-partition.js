class PartitionedVertex {
    constructor() {
        this.index = 0;
        this.boneIndices = [0, 0, 0, 0];
    }
}

class SkinPartition {
    constructor() {
        this.partition = 0;
        this.vertexStart = 0;
        this.vertexCount = 0;
        this.indexStart = 0;
        this.indexCount = 0;

        // Indices of bones in this partition. skin matrices will be uploaded to the vertex shader in this order.
        this.boneIndices = [];

        // Partitioned vertex attributes
        this.vertices = [];
        // Partitioned vertex indices
        this.indices = [];
        // Maps the index of an un-partitioned vertex to that same vertex if it has been added
        // to this particular partition. speeds up checking for duplicate vertices so we don't
        // add the same vertex more than once.
        this.indexMap = {};

        this.originalMesh = null;
    }

    addVertex(vertex, idx, vertexArray) {
        var remappedIndex = -1;
        if (this.indexMap[idx] !== undefined) {
            remappedIndex = this.indexMap[idx];
            this.indices.push(remappedIndex);
        } else {
            // Create new partitioned vertex
            for (var influence = 0; influence < 4; influence++ ) {
                if (vertexArray.blendWeight.data[idx * 4 + influence] === 0)
                    continue;

                var originalBoneIndex = vertexArray.blendIndices.data[vertex.index * 4 + influence];
                vertex.boneIndices[influence] = this.getBoneRemap(originalBoneIndex);
            }
            remappedIndex = this.vertices.length;
            this.indices.push(remappedIndex);
            this.vertices.push(vertex);
            this.indexMap[idx] = remappedIndex;
        }
    }

    addPrimitive(vertices, vertexIndices, vertexArray, boneLimit) {
        // Build a list of all the bones used by the vertex that aren't currently in this partition
        var i, j;
        var bonesToAdd = [];
        var bonesToAddCount = 0;
        var vertexCount = vertices.length;
        for (i = 0; i < vertexCount; i++) {
            var vertex = vertices[i];
            var idx = vertex.index;
            for (var influence = 0; influence < 4; influence++) {
                if (vertexArray.blendWeight.data[idx * 4 + influence] > 0) {
                    var boneIndex = vertexArray.blendIndices.data[idx * 4 + influence];
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
            this.addVertex(vertices[i], vertexIndices[i], vertexArray);
        }

        return true;
    }

    getBoneRemap(boneIndex) {
        for (var i = 0; i < this.boneIndices.length; i++ ) {
            if (this.boneIndices[i] === boneIndex) {
                return i;
            }
        }
        return -1;
    }
}

function indicesToReferences(model) {
    var i;
    var vertices = model.vertices;
    var skins = model.skins;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;

    for (i = 0; i < meshes.length; i++) {
        meshes[i].vertices = vertices[meshes[i].vertices];
        if (meshes[i].skin !== undefined) {
            meshes[i].skin = skins[meshes[i].skin];
        }
    }
    for (i = 0; i < meshInstances.length; i++) {
        meshInstances[i].mesh = meshes[meshInstances[i].mesh];
    }
}

function referencesToIndices(model) {
    var i;
    var vertices = model.vertices;
    var skins = model.skins;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;

    for (i = 0; i < meshes.length; i++) {
        meshes[i].vertices = vertices.indexOf(meshes[i].vertices);
        if (meshes[i].skin !== undefined) {
            meshes[i].skin = skins.indexOf(meshes[i].skin);
        }
    }
    for (i = 0; i < meshInstances.length; i++) {
        meshInstances[i].mesh = meshes.indexOf(meshInstances[i].mesh);
    }
}

function partitionSkin(model, materialMappings, boneLimit) {
    var i, j, k, index;

    // Replace object indices with actual object references
    // This simplifies insertion/removal of array items
    indicesToReferences(model);

    var vertexArrays = model.vertices;
    var skins = model.skins;
    var mesh;
    var meshes = model.meshes;
    var meshInstances = model.meshInstances;

    var getVertex = function (idx) {
        var vert = new PartitionedVertex();
        vert.index = idx;
        return vert;
    };

    for (i = skins.length - 1; i >= 0; i--) {
        // This skin exceeds the bone limit. Split it!
        if (skins[i].boneNames.length > boneLimit) {
            var skin = skins.splice(i, 1)[0];

            // Build a list of meshes that use this skin
            var meshesToSplit = [];
            for (j = 0; j < meshes.length; j++) {
                if (meshes[j].skin === skin) {
                    meshesToSplit.push(meshes[j]);
                }
            }
            // Remove meshes from source array
            for (j = 0; j < meshesToSplit.length; j++) {
                index = meshes.indexOf(meshesToSplit[j]);
                if (index !== -1) {
                    meshes.splice(index, 1);
                }
            }

            // Error handling
            if (meshesToSplit.length === 0) {
                throw new Error('partitionSkin: There should be at least one mesh that references a skin');
            }

            var vertexArray = meshesToSplit[0].vertices;
            for (j = 1; j < meshesToSplit.length; j++) {
                if (meshesToSplit[j].vertices !== vertexArray) {
                    throw new Error('partitionSkin: All meshes that share a skin should also share the same vertex buffer');
                }
            }

            var partition;
            var partitions = [];

            // Phase 1:
            // Build the skin partitions
            // Go through index list and extract primitives and add them to bone partitions
            // Since we are working with a single triangle list, everything is a triangle
            var primitiveVertices = [];
            var primitiveIndices = [];
            var basePartition = 0;

            for (j = 0; j < meshesToSplit.length; j++) {
                mesh = meshesToSplit[j];
                var indices = mesh.indices;
                for (var iIndex = mesh.base; iIndex < mesh.base + mesh.count; ) {
                    // Extract primitive
                    // Convert vertices
                    // There is a little bit of wasted time here if the vertex was already added previously
                    index = indices[iIndex++];
                    primitiveVertices[0] = getVertex(index);
                    primitiveIndices[0] = index;

                    index = indices[iIndex++];
                    primitiveVertices[1] = getVertex(index);
                    primitiveIndices[1] = index;

                    index = indices[iIndex++];
                    primitiveVertices[2] = getVertex(index);
                    primitiveIndices[2] = index;

                    // Attempt to add the primitive to an existing bone partition
                    var added = false;
                    for (var iBonePartition = basePartition; iBonePartition < partitions.length; iBonePartition++) {
                        partition = partitions[iBonePartition];
                        if (partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit)) {
                            added = true;
                            break;
                        }
                    }

                    // If the primitive was not added to an existing bone partition, we need to make a new bone partition and add the primitive to it
                    if (!added) {
                        partition = new SkinPartition();
                        partition.originalMesh = mesh;
                        partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit);
                        partitions.push(partition);
                    }
                }

                basePartition = partitions.length;
            }

            // Phase 2:
            // Gather vertex and index lists from all the partitions, then upload to GPU
            var partitionedVertices = [];
            var partitionedIndices = [];

            for (j = 0; j < partitions.length; j++) {
                partition = partitions[j];

                if (partition.vertices.length && partition.indices.length) {
                    // this bone partition contains vertices and indices

                    // Find offsets
                    var vertexStart = partitionedVertices.length;
                    var vertexCount = partition.vertices.length;
                    var indexStart = partitionedIndices.length;
                    var indexCount = partition.indices.length;

                    // Make a new sub set
                    partition.partition = j;
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
            // Create the split skins
            var splitSkins = [];
            for (j = 0; j < partitions.length; j++) {
                partition = partitions[j];

                var ibp = [];
                var boneNames = [];
                for (k = 0; k < partition.boneIndices.length; k++) {
                    ibp.push(skin.inverseBindMatrices[partition.boneIndices[k]]);
                    boneNames.push(skin.boneNames[partition.boneIndices[k]]);
                }

                var splitSkin = {
                    inverseBindMatrices: ibp,
                    boneNames: boneNames
                };
                splitSkins.push(splitSkin);
                skins.push(splitSkin);
            }

            // Phase 4

            // Create a partitioned vertex array
            var attrib, attribName, data, components;
            var splitVertexArray = {};

            // Create a vertex array of the same format as the input to take partitioned vertex data
            for (attribName in vertexArray) {
                splitVertexArray[attribName] = {
                    components: vertexArray[attribName].components,
                    data: [],
                    type: vertexArray[attribName].type
                };
            }

            // Copy across the vertex data. Everything is the same as the source data except the remapped
            // bone indices
            for (attribName in vertexArray) {
                if (attribName === 'blendIndices') {
                    var dstBoneIndices = splitVertexArray[attribName].data;
                    for (j = 0; j < partitionedVertices.length; j++) {
                        var srcBoneIndices = partitionedVertices[j].boneIndices;
                        dstBoneIndices.push(srcBoneIndices[0], srcBoneIndices[1], srcBoneIndices[2], srcBoneIndices[3]);
                    }
                } else {
                    attrib = vertexArray[attribName];
                    data = attrib.data;
                    components = attrib.components;
                    for (j = 0; j < partitionedVertices.length; j++) {
                        index = partitionedVertices[j].index;
                        for (k = 0; k < components; k++) {
                            splitVertexArray[attribName].data.push(data[index * components + k]);
                        }
                    }
                }
            }

            // Replace original vertex array with split one
            vertexArrays[vertexArrays.indexOf(vertexArray)] = splitVertexArray;

            // Phase 5

            // Build new mesh array
            for (j = 0; j < partitions.length; j++) {
                partition = partitions[j];

                mesh = {
                    aabb: {
                        min: [0, 0, 0],
                        max: [0, 0, 0]
                    },
                    vertices: splitVertexArray,
                    skin: splitSkins[j],
                    indices: partitionedIndices.splice(0, partition.indexCount),
                    type: 'triangles',
                    base: 0,
                    count: partition.indexCount
                };

                meshes.push(mesh);

                // Find all the original mesh instances that referred to the pre-split mesh
                for (k = meshInstances.length - 1; k >= 0; k--) {
                    if (meshInstances[k].mesh === partition.originalMesh) {
                        meshInstances.push({
                            mesh: mesh,
                            node: meshInstances[k].node
                        });
                        if (materialMappings) {
                            materialMappings.push({
                                material: materialMappings[k].material,
                                path: materialMappings[k].path
                            });
                        }
                    }
                }
            }

            for (j = 0; j < partitions.length; j++) {
                partition = partitions[j];

                // Find all the original mesh instances that referred to the pre-split mesh
                for (k = meshInstances.length - 1; k >= 0; k--) {
                    if (meshInstances[k].mesh === partition.originalMesh) {
                        meshInstances.splice(k, 1);
                        if (materialMappings) {
                            materialMappings.splice(k, 1);
                        }
                    }
                }
            }
        }
    }

    // Convert references back to indices
    referencesToIndices(model);
}

export { partitionSkin };
