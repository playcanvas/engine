pc.extend(pc.resources, function () {
	/**
	 * @name pc.resources.ModelResourceHandler
	 * @description Resource Handler for creating pc.scene.Model resources
	 */
	var ModelResourceHandler = function () {
        this._jsonToPrimitiveType = {
            "points":         pc.gfx.PrimType.POINTS,
            "lines":          pc.gfx.PrimType.LINES,
            "linestrip":      pc.gfx.PrimType.LINE_STRIP,
            "triangles":      pc.gfx.PrimType.TRIANGLES,
            "trianglestrip":  pc.gfx.PrimType.TRIANGLE_STRIP
        }

        this._jsonToVertexElementType = {
            "int8":     pc.gfx.VertexElementType.INT8,
            "uint8":    pc.gfx.VertexElementType.UINT8,
            "int16":    pc.gfx.VertexElementType.INT16,
            "uint16":   pc.gfx.VertexElementType.UINT16,
            "int32":    pc.gfx.VertexElementType.INT32,
            "uint32":   pc.gfx.VertexElementType.UINT32,
            "float32":  pc.gfx.VertexElementType.FLOAT32
        }

        this._jsonToLightType = {
            "directional": pc.scene.LightType.DIRECTIONAL,
            "point":       pc.scene.LightType.POINT,
            "spot":        pc.scene.LightType.SPOT
        }
        
        this._jsonToAddressMode = {
            "repeat": pc.gfx.TextureAddress.REPEAT,
            "clamp":  pc.gfx.TextureAddress.CLAMP_TO_EDGE,
            "mirror": pc.gfx.TextureAddress.MIRRORED_REPEAT
        }
        
        this._jsonToFilterMode = {
            "nearest":             pc.gfx.TextureFilter.NEAREST,
            "linear":              pc.gfx.TextureFilter.LINEAR,
            "nearest_mip_nearest": pc.gfx.TextureFilter.NEAREST_MIPMAP_NEAREST,
            "linear_mip_nearest":  pc.gfx.TextureFilter.LINEAR_MIPMAP_NEAREST,
            "nearest_mip_linear":  pc.gfx.TextureFilter.NEAREST_MIPMAP_LINEAR,
            "linear_mip_linear":   pc.gfx.TextureFilter.LINEAR_MIPMAP_LINEAR
        }
        
        this._jsonToProjectionType = {
            "perspective"  : pc.scene.Projection.PERSPECTIVE,
            "orthographic" : pc.scene.Projection.ORTHOGRAPHIC
        }
	};
	ModelResourceHandler = ModelResourceHandler.extendsFrom(pc.resources.ResourceHandler);
	
	/**
	 * @function
	 * @name pc.resources.ModelResourceHandler#load
	 * @description Fetch model data from a remote url
	 * @param {String} identifier The URL of the model data to load
	 * @param {Function} success The callback used when the data is successfully loaded and the resource opened. Passed the new resource object
	 * @param {Function} error The callback used when there is an error loading the resource. Passed a list of error messages
	 * @param {Function} progress The callback used to indicate loading progress. Passed a percentage number.
	 * @param {Object} [options]
	 * @param {Number} [options.priority] The priority to load the model textures at.
	 */
    ModelResourceHandler.prototype.load = function (identifier, success, error, progress, options) {
    	var url = identifier;
    	options = options || {};
        options.directory = pc.path.getDirectory(url);
/*
        pbinUrl = url.substr(0, url.lastIndexOf('.')) + '.bin';
        pc.net.http.get(pbinUrl, function (response) {
            options.bin = response;
*/
            pc.net.http.get(url, function (response) {
                try {
                    success(response, options);
                } catch (e) {
                    error(pc.string.format("An error occured while loading model from: '{0}'", url));
                }
            }.bind(this), {
                cache:false
            });
            /*
        }.bind(this), {
            responseType: 'arraybuffer',
            cache:false
        });*/
    };
	
	/**
	 * @function
	 * @name pc.resources.ModelResourceHandler#open
	 * @description Process data in deserialized format into a pc.scene.Model object
	 * @param {Object} data The data from model file deserialized into a Javascript Object
	 * @param {Object} [options]
	 * @param {Number} [options.priority] The priority to load the textures at
	 * @param {String} [options.directory] The directory to load textures from 
	 */
    ModelResourceHandler.prototype.open = function (data, options) {
    	options = options || {};
    	options.directory = options.directory || "";
    	options.priority = options.priority || 1; // default priority of 1
    	options.batch = options.batch || null;
    	
        model = this._loadModel(data, options);
    	return model;
    };
        
    ModelResourceHandler.prototype._loadNode = function (model, modelData, nodeData) {
        var node = new pc.scene.GraphNode();
        
        // Node properties
        node.setName(nodeData.name);
        node.addGraphId(nodeData.uid);
        node.setLocalTransform(pc.math.mat4.clone(nodeData.transform));
    
        return node;
    };
    
    ModelResourceHandler.prototype._loadCamera = function (model, modelData, cameraData) {
        var camera = new pc.scene.CameraNode();

        // Node properties
        camera.setName(cameraData.name);
        camera.addGraphId(cameraData.uid);
        camera.setLocalTransform(pc.math.mat4.clone(cameraData.transform));
    
        // Camera properties
        var projection = this._jsonToProjectionType[cameraData.projection];
        camera.setProjection(projection);
        camera.setNearClip(cameraData.nearClip);
        camera.setFarClip(cameraData.farClip);
        camera.setFov(cameraData.fov);
        camera.setClearOptions({
            color: cameraData.clearColor || [0, 0, 0, 1],
            depth: 1,
            flags: pc.gfx.ClearFlag.COLOR | pc.gfx.ClearFlag.DEPTH
        });
        if (cameraData.lookAt) {
            camera._lookAtId = cameraData.lookAt;
        }
        if (cameraData.up) {
            camera._upId = cameraData.up;
        }
        return camera;
    };

    ModelResourceHandler.prototype._loadLight = function (model, modelData, lightData) {
        var light = new pc.scene.LightNode();
            
        // Node properties
        light.setName(lightData.name);
        light.addGraphId(lightData.uid);
        light.setLocalTransform(pc.math.mat4.clone(lightData.transform));
    
        // Translate the light type
        var type = this._jsonToLightType[lightData.light_type];

        switch (type) {
            case pc.scene.LightType.SPOT:
                light.setInnerConeAngle(lightData.innerConeAngle || 40);
                light.setOuterConeAngle(lightData.outerConeAngle || 45);
            case pc.scene.LightType.POINT:
                light.setAttenuationStart(lightData.start || 0);
                light.setAttenuationEnd(lightData.end || 1);
            default: // All lights
                light.setType(type);
                light.setEnabled(lightData.enabled);
                light.setColor(lightData.color);
                light.setIntensity(lightData.intensity || 1);
                light.setCastShadows(lightData.castShadows);
        }

        return light;
    };
    
    ModelResourceHandler.prototype._loadMesh = function (model, modelData, meshData) {
        var mesh = new pc.scene.MeshNode();
            
        // Node properties
        mesh.setName(meshData.name);
        mesh.addGraphId(meshData.uid);
        mesh.setLocalTransform(pc.math.mat4.clone(meshData.transform));
    
        // Mesh properties
        var geometryId = meshData.geometry;
        var geometry   = model.getGeometries()[geometryId];
        mesh.setGeometry(geometry);
    
        return mesh;
    };
    
    /**
     * @function
     * @name pc.resources.ModelResourceHandler#_loadTexture
     * @description
     * @param model
     * @param modelData
     * @param texturesData
     * @param options
     * @param options.directory The directory to load the texture from
     * @param options.priority The priority to load the textures with
     * @param [options.batch] An existing request batch handle to add the texture request to 
     */
    ModelResourceHandler.prototype._loadTexture = function (model, modelData, textureData, options) {
        var addressu  = this._jsonToAddressMode[textureData.addressu];
        var addressv  = this._jsonToAddressMode[textureData.addressv];
        var minFilter = this._jsonToFilterMode[textureData.minfilter];
        var magFilter = this._jsonToFilterMode[textureData.magfilter];
        
        var texture = new pc.gfx.Texture2D();
        
        var url = options.directory + "/" + textureData.uri;
		
		// Make a new request for the Image resource at the same priority as the Model was requested.
        this._loader.request([new pc.resources.ImageRequest(url)], options.priority, function (resources) {
        	texture.setSource(resources[url]);	
        }, function (errors, resources) {
        	Object.keys(errors).forEach(function (key) {
        	   logERROR(errors[key]);    
        	});
        }, function (progress) {
        	// no progress features
        }, options);
        
        texture.setName(textureData.name);
        texture.setAddressMode(addressu, addressv);
        texture.setFilterMode(minFilter, magFilter);
        texture.transform = textureData.transform;
        return texture;
    };
    
    ModelResourceHandler.prototype._loadMaterial = function(model, modelData, materialData) {
        var material = new pc.scene.Material();
        material.setName(materialData.name);
        material.setProgramName(materialData.shader);

        // Read each shader parameter
        for (var i = 0; i < materialData.parameters.length; i++) {
            var param = materialData.parameters[i];
            if (param.type === "sampler") {
                var texture = model.getTextures()[param.data];
                if (texture === undefined) {
                    logERROR("Texture " + name + " not found in model's texture dictionary.");
                }
                material.setParameter(param.name, texture);
                if (texture.transform === undefined) {
                    material.setParameter(param.name + "Transform", pc.math.mat4.create());
                } else {
                    material.setParameter(param.name + "Transform", pc.math.mat4.create(texture.transform));
                }
            } else {
                if (param.type === 'float') {
                    material.setParameter(param.name, param.data);
                } else {
                    material.setParameter(param.name, pc.math[param.type].clone(param.data));
                }
            }
        }
    
        return material;
    };
    
    ModelResourceHandler.prototype._loadSubMesh = function (model, modelData, subMeshData) {
        // Look up the material
        var material = model.getMaterials()[subMeshData.material];
        if (material === undefined) {
            logERROR("Material " + subMeshData.material + " not found in model's material dictionary.");
        }

        var subMesh = {
            material: material,
            primitive: {
                type: this._jsonToPrimitiveType[subMeshData.primitive.type],
                base: subMeshData.primitive.base,
                count: subMeshData.primitive.count,
                indexed: subMeshData.primitive.indexed
            }
        };

        return subMesh;
    };

    ModelResourceHandler.prototype._partitionSkinnedGeometry = function (geometryData, maxBonesPerPartition) {
        var partitions = [];
        var partitionedVertices = [];
        var partitionedIndices = [];
        var partitionedBones = [];

        // Phase 1:  
        // Build the skin partitions
        var primitiveVertices = [];
        var primitiveVertexIndices = [];
        var primitiveVertexCount = 3; // Assume only triangle list support for now

        // Go through index list and extract primitives and add them to bone partitions  
        // Since we are working with a single triangle list, everything is a triangle
        var basePartition = 0;
        var indexList = geometryData.indices.data;
        for (var iSubMesh = 0; iSubMesh < geometryData.submeshes.length; iSubMesh++) {
            var submesh = geometryData.submeshes[iSubMesh];
            for (var iIndex = submesh.primitive.base; iIndex < submesh.primitive.base + submesh.primitive.count; ) {  
                // Extact primitive  
                // Convert vertices  
                // There is a little bit of wasted time here if the vertex was already added previously  
                var index;  

                index = indexList[iIndex++];
                primitiveVertices[0] = new Vertex();  
                primitiveVertices[0].extract(geometryData, index);  
                primitiveVertexIndices[0] = index;

                index = indexList[iIndex++];  
                primitiveVertices[1] = new Vertex();  
                primitiveVertices[1].extract(geometryData, index);  
                primitiveVertexIndices[1] = index; 

                index = indexList[iIndex++];  
                primitiveVertices[2] = new Vertex();  
                primitiveVertices[2].extract(geometryData, index);  
                primitiveVertexIndices[2] = index;  

                // Attempt to add the primitive to an existing bone partition  
                var added = false;
                for (var iBonePartition = basePartition; iBonePartition < partitions.length; iBonePartition++) {
                    var partition = partitions[iBonePartition];  
                    if (partition.addPrimitive(primitiveVertexCount, primitiveVertices, primitiveVertexIndices, maxBonesPerPartition)) {  
                        added = true;  
                        break;  
                    }
                }

                // If the primitive was not added to an existing bone partition, we need to make a new bone partition and add the primitive to it  
                if (!added) {
                    var partition = new SkinPartition();
                    partition.material = submesh.material;
                    partitions.push(partition);
                    partition.addPrimitive(primitiveVertexCount, primitiveVertices, primitiveVertexIndices, maxBonesPerPartition);  
                }
            }  

            basePartition = partitions.length;
        }

        // Phase 2:
        // Gather vertex and index lists from all the partitions, then upload to GPU  
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

                // Clean up  
                partition.clear();  
            }  
        }

        // Phase 3:
        // Update geometry data to reflect partitions

        // Blank data arrays
        for (var i = 0; i < partitionedVertices.length; i++) {
            for (var j = 0; j < geometryData.attributes.length; j++) {
                geometryData.attributes[j].data = [];
            }
        }
        // Copy partitioned verts back to JSON structure
        for (var i = 0; i < partitionedVertices.length; i++) {
            for (var j = 0; j < geometryData.attributes.length; j++) {
                var attribute = geometryData.attributes[j];
                for (var k = 0; k < attribute.components; k++) {
                    attribute.data.push(partitionedVertices[i][attribute.name][k]);
                }
            }
        }
        // Copy partitioned indices back to geometry submesh indices
        var subMeshes = [];
        var indices = [];
        geometryData.partitionedBoneIndices = [];
        for (var iPartition = 0; iPartition < partitions.length; iPartition++) {
            var partition = partitions[iPartition];
            var subMesh = {
                material: partition.material,
                primitive: {
                    type: "triangles",
                    base: indices.length,
                    count: partition.indexCount,
                    indexed: true
                }
            };

            subMeshes.push(subMesh);

            geometryData.partitionedBoneIndices.push(partition.boneIndices);

            indices = indices.concat(partitionedIndices.splice(0, partition.indexCount));
        }

        geometryData.indices.data = indices;
        geometryData.submeshes = subMeshes;
    };

    ModelResourceHandler.prototype._loadGeometry = function(model, modelData, geomData, buffers) {
        var geometry = new pc.scene.Geometry();
    
        // Skinning data
        if (geomData.inverse_bind_pose !== undefined) {
            var device = pc.gfx.Device.getCurrent();
            var maxBones = device.getBoneLimit();
            if (geomData.inverse_bind_pose.length > maxBones) {
                // FIXME!!: This is here to duplicate the incoming JSON because requests to
                // the same URL passes in the same data, making the assumption it is read
                // only.  Unfortunately, the skin partition code writes to this data.  A
                // good fix would be to make skin partitioning a geometry utility library.
                geomData = pc.extend({}, geomData);
                this._partitionSkinnedGeometry(geomData, maxBones);

                geometry._partitionedBoneIndices = [];
                geometry._partitionedPalettes = [];
                if (geomData.partitionedBoneIndices) {
                    for (var i = 0; i < geomData.partitionedBoneIndices.length; i++) {
                        geometry._partitionedBoneIndices.push(geomData.partitionedBoneIndices[i].slice(0));
                        geometry._partitionedPalettes.push(new Float32Array(geomData.partitionedBoneIndices[i].length * 16));
                    }
                }
            }
    
            var inverseBindPose = [];
            for (var i = 0; i < geomData.inverse_bind_pose.length; i++) {
                inverseBindPose[i] = pc.math.mat4.clone(geomData.inverse_bind_pose[i]);
            }
            geometry.setInverseBindPose(inverseBindPose);

            geometry._boneIds = geomData.bone_ids;
        }

        // Calculate tangents if we have positions, normals and texture coordinates
        var positions = null, normals = null, uvs = null, tangents = null;
        for (var i = 0; i < geomData.attributes.length; i++) {
            var entry = geomData.attributes[i];
    
            if (entry.name === "vertex_position") {
                // Calculate a bounding sphere for the geometry
                var sphere = new pc.shape.Sphere();
                sphere.compute(entry.data);
                geometry.setVolume(sphere);

                if (!geomData.bbox) {
                    var aabb = new pc.shape.Aabb();
                    aabb.compute(entry.data);
                    geometry.setAabb(sphere);
                }

                positions = entry.data;
            }
            if (entry.name === "vertex_normal") {
                normals = entry.data;
            }
            if (entry.name === "vertex_tangent") {
                tangents = entry.data;
            }
            if (entry.name === "vertex_texCoord0") {
                uvs = entry.data;
            }
        }

        if (!tangents && positions && normals && uvs) {
            var tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, geomData.indices.data);
            geomData.attributes.push({ name: "vertex_tangent", type: "float32", components: 4, data: tangents });
        }
    
        // Generate the vertex format for the geometry's vertex buffer
        var vertexFormat = new pc.gfx.VertexFormat();
        vertexFormat.begin();
        for (var i = 0; i < geomData.attributes.length; i++) {
            var attribute = geomData.attributes[i];
    
            // Create the vertex format for this buffer
            var attributeType = this._jsonToVertexElementType[attribute.type];
            vertexFormat.addElement(new pc.gfx.VertexElement(attribute.name, attribute.components, attributeType));
        }
        vertexFormat.end();
    
        // Create the vertex buffer
        var numVertices = geomData.attributes[0].data.length / geomData.attributes[0].components;
        var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, numVertices);

        var iterator = new pc.gfx.VertexIterator(vertexBuffer);
        for (var i = 0; i < numVertices; i++) {
            for (var j = 0; j < geomData.attributes.length; j++) {
               var attribute = geomData.attributes[j];
                switch (attribute.components) {
                    case 1:
                        iterator.element[attribute.name].set(attribute.data[i]);
                        break;
                    case 2:
                        iterator.element[attribute.name].set(attribute.data[i * 2], attribute.data[i * 2 + 1]);
                        break;
                    case 3:
                        iterator.element[attribute.name].set(attribute.data[i * 3], attribute.data[i * 3 + 1], attribute.data[i * 3 + 2]);
                        break;
                    case 4:
                        iterator.element[attribute.name].set(attribute.data[i * 4], attribute.data[i * 4 + 1], attribute.data[i * 4 + 2], attribute.data[i * 4 + 3]);
                        break;
                }
            }
            iterator.next();
        }
        iterator.end();
    
        geometry.getVertexBuffers().push(vertexBuffer);

        // Create the index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, geomData.indices.data.length);
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(geomData.indices.data);
        indexBuffer.unlock();
        geometry.setIndexBuffer(indexBuffer);
/*
        geometry.getVertexBuffers().push(buffers.vb);
        geometry.setIndexBuffer(buffers.ib);

        var sphere = new pc.shape.Sphere();
        sphere.radius = 30;
        geometry.setVolume(sphere);
*/
        // Create and read each submesh
        for (var i = 0; i < geomData.submeshes.length; i++) {
            var subMesh = this._loadSubMesh(model, modelData, geomData.submeshes[i]);
    
            geometry.getSubMeshes().push(subMesh);
        }

        // Set the local space axis-aligned bounding box of the geometry
        if (geomData.bbox) {
            var min = geomData.bbox.min;
            var max = geomData.bbox.max;
            var aabb = new pc.shape.Aabb(
                pc.math.vec3.create((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                pc.math.vec3.create((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
            );
            geometry.setAabb(aabb);
        }

        return geometry;
    };

    var attribs = {
        POSITION: 1 << 0,
        NORMAL: 1 << 1,
        BONEINDICES: 1 << 5,
        BONEWEIGHTS: 1 << 6,
        UV0: 1 << 7,
        UV1: 1 << 8
    };

    function getChunkHeaderId(id) {
        var str = "";
        str += String.fromCharCode(id & 0xff);
        str += String.fromCharCode((id >> 8) & 0xff);
        str += String.fromCharCode((id >> 16) & 0xff);
        str += String.fromCharCode((id >> 24) & 0xff);
        return str;
    }

    function copyToBuffer(dstBuffer, srcBuffer, srcAttribs, srcStride) {
        var hasPositions = (srcAttribs & attribs.POSITION) !== 0;
        var hasNormals = (srcAttribs & attribs.POSITION) !== 0;
        var hasUvs = (srcAttribs & attribs.POSITION) !== 0;
        var addTangents = hasPositions && hasNormals && hasUvs;

        if (addTangents) {
            var preSize = 0;
            // Only positions and normals can occur before tangents in a vertex buffer
            if (srcAttribs & attribs.POSITION) {
                preSize += 12;
            }
            if (srcAttribs & attribs.NORMAL) {
                preSize += 12;
            }
            var postSize = srcStride - preSize; // Everything else
            
            var numVerts = srcBuffer.length / srcStride;
            var srcIndex = 0;
            var dstIndex = 0;
            var i, j;
            for (i = 0; i < numVerts; i++) {
                for (j = 0; j < preSize; j++) {
                    dstBuffer[dstIndex++] = srcBuffer[srcIndex++];
                }
                for (j = 0; j < 16; j++) {
                    dstBuffer[dstIndex++] = 0;
                }
                for (j = 0; j < postSize; j++) {
                    dstBuffer[dstIndex++] = srcBuffer[srcIndex++];
                }
            }
        } else {
            dstBuffer.set(srcBuffer);
        }
    }

    function translateFormat(attributes) {
        var vertexFormat = new pc.gfx.VertexFormat();

        vertexFormat.begin();
        if (attributes & attribs.POSITION) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.NORMAL) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_normal", 3, pc.gfx.VertexElementType.FLOAT32));
        }
        // If we've got positions, normals and uvs, add tangents which will be auto-generated
        if ((attributes & attribs.POSITION) && (attributes & attribs.NORMAL) && (attributes & attribs.UV0)) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_tangent", 4, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.BONEINDICES) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_boneIndices", 4, pc.gfx.VertexElementType.UINT8));
        }
        if (attributes & attribs.BONEWEIGHTS) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_boneWeights", 4, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV0) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord0", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV1) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord1", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        vertexFormat.end();

        return vertexFormat;
    }

    function generateTangentsInPlace(vertexFormat, vertices, indices) {
        var stride = vertexFormat.size;
        var positions, normals, tangents, uvs;
        for (var el = 0; el < vertexFormat.elements.length; el++) {
            var element = vertexFormat.elements[el];
            if (element.scopeId.name === 'vertex_position') {
                positions = new Float32Array(vertices, element.offset);
            } else if (element.scopeId.name === 'vertex_normal') {
                normals = new Float32Array(vertices, element.offset);
            } else if (element.scopeId.name === 'vertex_tangent') {
                tangents = new Float32Array(vertices, element.offset);
            } else if (element.scopeId.name === 'vertex_texCoord0') {
                uvs = new Float32Array(vertices, element.offset);
            }
        }

        var triangleCount = indices.length / 3;
        var vertexCount   = vertices.byteLength / stride;
        var i1, i2, i3;
        var v1, v2, v3;
        var w1, w2, w3;
        var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
        var temp  = pc.math.vec3.create(0, 0, 0);
        var i; // Loop counter
        var tan1 = [];
        var tan2 = [];
        for (var i = 0; i < vertexCount; i++) {
            tan1[i] = pc.math.vec3.create(0, 0, 0);
            tan2[i] = pc.math.vec3.create(0, 0, 0);
        }
        var sdir, tdir;

        for (i = 0; i < triangleCount; i++) {
            i1 = indices[i * 3];
            i2 = indices[i * 3 + 1];
            i3 = indices[i * 3 + 2];

            v1 = pc.math.vec3.create(positions[i1 * (stride / 4)], positions[i1 * (stride / 4) + 1], positions[i1 * (stride / 4) + 2]);
            v2 = pc.math.vec3.create(positions[i2 * (stride / 4)], positions[i2 * (stride / 4) + 1], positions[i2 * (stride / 4) + 2]);
            v3 = pc.math.vec3.create(positions[i3 * (stride / 4)], positions[i3 * (stride / 4) + 1], positions[i3 * (stride / 4) + 2]);

            w1 = pc.math.vec2.create(uvs[i1 * (stride / 4)], uvs[i1 * (stride / 4) + 1]);
            w2 = pc.math.vec2.create(uvs[i2 * (stride / 4)], uvs[i2 * (stride / 4) + 1]);
            w3 = pc.math.vec2.create(uvs[i3 * (stride / 4)], uvs[i3 * (stride / 4) + 1]);

            x1 = v2[0] - v1[0];
            x2 = v3[0] - v1[0];
            y1 = v2[1] - v1[1];
            y2 = v3[1] - v1[1];
            z1 = v2[2] - v1[2];
            z2 = v3[2] - v1[2];

            s1 = w2[0] - w1[0];
            s2 = w3[0] - w1[0];
            t1 = w2[1] - w1[1];
            t2 = w3[1] - w1[1];

            r = 1.0 / (s1 * t2 - s2 * t1);
            sdir = pc.math.vec3.create((t2 * x1 - t1 * x2) * r, 
                                       (t2 * y1 - t1 * y2) * r,
                                       (t2 * z1 - t1 * z2) * r);
            tdir = pc.math.vec3.create((s1 * x2 - s2 * x1) * r,
                                       (s1 * y2 - s2 * y1) * r,
                                       (s1 * z2 - s2 * z1) * r);
            
            pc.math.vec3.add(tan1[i1], sdir, tan1[i1]);
            pc.math.vec3.add(tan1[i2], sdir, tan1[i2]);
            pc.math.vec3.add(tan1[i3], sdir, tan1[i3]);
            
            pc.math.vec3.add(tan2[i1], tdir, tan2[i1]);
            pc.math.vec3.add(tan2[i2], tdir, tan2[i2]);
            pc.math.vec3.add(tan2[i3], tdir, tan2[i3]);
        }

        for (i = 0; i < vertexCount; i++) {
            var n = pc.math.vec3.create(normals[i * (stride / 4)], normals[i * (stride / 4) + 1], normals[i * (stride / 4) + 2]);
            var t = tan1[i];
            
            // Gram-Schmidt orthogonalize
            var ndott = pc.math.vec3.dot(n, t);
            pc.math.vec3.scale(n, ndott, temp);
            pc.math.vec3.subtract(t, temp, temp);
            pc.math.vec3.normalize(temp, temp);

            tangents[i * (stride / 4)]     = temp[0];
            tangents[i * (stride / 4) + 1] = temp[1];
            tangents[i * (stride / 4) + 2] = temp[2];

            // Calculate handedness
            pc.math.vec3.cross(n, t, temp);
            tangents[i * (stride / 4) + 3] = (pc.math.vec3.dot(temp, tan2[i]) < 0.0) ? -1.0 : 1.0;
        }
    }

    function parseBin(bin) {
        // Parse file header
        var fileHeader = new Uint32Array(bin, 0, 3);
        if(getChunkHeaderId(fileHeader[0]) !== "pbin") {
            throw new Error("BIN file has invalid file header id.");
        }
        if (fileHeader[1] !== 1) {
            throw new Error("BIN file version is unsupported.");
        }
        var numChunks = fileHeader[2];
        var buffers = [];

        // Parse chunks
        for (i = 0; i < numChunks; i+=2) {
            // Extract vertex/index buffer data from the BIN file
            var chunkHeader = new Uint32Array(bin, (3 + (i * 3)) * 4, 3);
            if (getChunkHeaderId(chunkHeader[0]) !== "vbuf") {
                throw new Error("Expected to find a vertex buffer in BIN stream.");
            }
            var vbuffInfo = new Uint32Array(bin, chunkHeader[1], 2);
            var vbuffFormat = vbuffInfo[0];
            var vbuffStride = vbuffInfo[1];
            var vbuffNumVerts = (chunkHeader[2] - 8) / vbuffStride;
            var vbuffData = new Uint8Array(bin, chunkHeader[1] + 8, chunkHeader[2] - 8);

            chunkHeader = new Uint32Array(bin, (3 + ((i + 1) * 3)) * 4, 3);
            if (getChunkHeaderId(chunkHeader[0]) !== "ibuf") {
                throw new Error("Expected to find an index buffer in BIN stream.");
            }
            var ibuffNumInds = chunkHeader[2] / 2;
            var ibuffData = new Uint16Array(bin, chunkHeader[1], ibuffNumInds);

            // Construct vertex/index buffers
            var ib = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, ibuffNumInds);
            var dst = new Uint16Array(ib.lock());
            dst.set(ibuffData);
            ib.unlock();

            // Create the vertex buffer
            var vertexFormat = translateFormat(vbuffFormat);

            var vb = new pc.gfx.VertexBuffer(vertexFormat, vbuffNumVerts);
            var dst = vb.lock();
            var dstBuffer = new Uint8Array(dst);
            copyToBuffer(dstBuffer, vbuffData, vbuffFormat, vbuffStride);
            generateTangentsInPlace(vertexFormat, dst, ibuffData);
            vb.unlock();

            buffers.push({
                vb: vb,
                ib: ib
            });
        }
        
        return buffers;
    }
    
    /**
    * @function
    * @name pc.resources.ModelResourceHandler#_loadModel
    * @description Load a pc.scene.Model from data in the PlayCanvas JSON format
    * @param {Object} json The data
    */
    ModelResourceHandler.prototype._loadModel = function (data, options) {
        var modelData = data.model;

        var model = new pc.scene.Model();
        var i;

        // Load in the shared resources of the model (textures, materials and geometries)
        if (modelData.textures) {
            var textures = model.getTextures();
            for (i = 0; i < modelData.textures.length; i++) {
                var textureData = modelData.textures[i];
                textures.push(this._loadTexture(model, modelData, textureData, options));
            }
        }

        var materials = model.getMaterials();
        for (i = 0; i < modelData.materials.length; i++) {
            var materialData = modelData.materials[i];
            materials.push(this._loadMaterial(model, modelData, materialData));
        }
/*    
        var buffers = parseBin(options.bin);
*/
        var geometries = model.getGeometries();
        for (i = 0; i < modelData.geometries.length; i++) {
            var geomData = modelData.geometries[i];
            geometries.push(this._loadGeometry(model, modelData, geomData/*, buffers[i]*/));
        }
    
        var _jsonToLoader = {
            "camera" : pc.callback(this, this._loadCamera),
            "light"  : pc.callback(this, this._loadLight),
            "mesh"   : pc.callback(this, this._loadMesh),
            "node"   : pc.callback(this, this._loadNode)
        };
    
        var _loadHierarchy = pc.callback(this, function (nodeData) {
            var node = null;
            var loadFunc = _jsonToLoader[nodeData.type];
            if (loadFunc !== undefined) {
                node = loadFunc(model, modelData, nodeData);
    
                if (node instanceof pc.scene.CameraNode)
                    model.getCameras().push(node);
                else if (node instanceof pc.scene.LightNode)
                    model.getLights().push(node);
                else if (node instanceof pc.scene.MeshNode)
                    model.getMeshes().push(node);

                // Now create and load each child
                if (nodeData.children !== undefined) {
                    for (var i = 0; i < nodeData.children.length; i++) {
                        var child = _loadHierarchy(nodeData.children[i]);
                        node.addChild(child);
                    }
                }
            } else {
                logERROR("Unknown graph node: " + nodeData.type);        
            }
    
            return node;
        });

        var _resolveCameraIds = function (node) {
            if (node instanceof pc.scene.CameraNode) {
                if (node._lookAtId) {
                    var lookAtNode = model.getGraph().findByGraphId(node._lookAtId);
                    node.setLookAtNode(lookAtNode);
                    delete node._lookAtId;
                }
                if (node._upId) {
                    var upNode = model.getGraph().findByGraphId(node._upId);
                    node.setUpNode(upNode);
                    delete node._upId;
                }
            }
            var children = node.getChildren();
            for (var i = 0; i < children.length; i++) {
                _resolveCameraIds(children[i]);
            }
        }

        var _clearGraphIds = function (node) {
            var i = 0;
            var children = node.getChildren();
            var length = children.length;
            
            node.removeGraphId();
            node.getChildren().forEach(function (child) {
                _clearGraphIds(child);
            }, this);
        };
        
        if (modelData.graph !== undefined) {
            var graph = _loadHierarchy(modelData.graph);
            model.setGraph(graph);

            // Resolve bone IDs to actual graph nodes
            var meshes = model.getMeshes();
            for (i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];
                var geom = mesh.getGeometry();
                if (geom._boneIds !== undefined) {
                    mesh._bones = [];
                    for (var j = 0; j < geom._boneIds.length; j++) {
                        var id = geom._boneIds[j];
                        var bone = graph.findByGraphId(id);
                        mesh._bones.push(bone);
                    }
                }
            }

            // Resolve camera aim/up graph node IDs to actual graph nodes            
            _resolveCameraIds(graph);

//            _clearGraphIds(graph);
        }
        
        return model;
    };

    
	var ModelRequest = function ModelRequest(identifier) {		
	};
	ModelRequest = ModelRequest.extendsFrom(pc.resources.ResourceRequest);
    ModelRequest.prototype.type = "model";

	var Vertex = function Vertex() {};
	// Returns a vertex from the JSON data in the followin format:
	// {
	//     "vertex_position": [x,y,z],
	//     ...
	// }
	Vertex.prototype.extract = function (geometryData, index) {
	    for (var i = 0; i < geometryData.attributes.length; i++) {
	        var attribute = geometryData.attributes[i];
	        this[attribute.name] = [];
	        for (var j = 0; j < attribute.components; j++) {
	            this[attribute.name].push(attribute.data[index * attribute.components + j]);
	        }
	    }
	};
	
	Vertex.prototype.clone = function () {
	    var newVertex = new Vertex();
	    for (i in this) {
	        if (this[i] instanceof Array) {
	            newVertex[i] = this[i];
	        }
	    } 
	    return newVertex;
	};
	
	var SkinPartition = function SkinPartition() {
	    this.partition = 0;
	    this.vertexStart = 0;
	    this.vertexCount = 0;
	    this.indexStart = 0;
	    this.indexCount = 0;
	
	    // Indices of bones in this partition. skin matrices will be uploaded to the vertex shader in this order.
	    this.boneIndices = []; 
	    
	    this.vertices = []; // Partitioned vertex attributes
	    this.indices  = []; // Partitioned vertex indices
	    this.indexMap = {}; // Maps the index of an un-partitioned vertex to that same vertex if it has been added to this particular partition. speeds up checking for duplicate vertices so we don't add the same vertex more than once.  
	};
	
	SkinPartition.prototype.addVertex = function (vertex, index) {
	    var remappedIndex = -1;
	    if (this.indexMap[index] !== undefined) {
	        remappedIndex = this.indexMap[index];
	        this.indices.push(remappedIndex);
	    } else {
	        // Create new partitioned vertex  
	        var vertexPartitioned = vertex.clone();  
	        for (var influence = 0; influence < 4; influence++ ) {
	            if (vertex["vertex_boneWeights"][influence] == 0 )  
	                continue;  
	
	            vertexPartitioned["vertex_boneIndices"][influence] = this.getBoneRemap(vertex["vertex_boneIndices"][influence]);
	        }  
	        remappedIndex = this.vertices.length;
	        this.indices.push(remappedIndex);  
	        this.vertices.push(vertexPartitioned);  
	        this.indexMap[index] = remappedIndex;  
	    }
	    return remappedIndex;
	};
	
	SkinPartition.prototype.addPrimitive = function (vertexCount, vertices, vertexIndices, maxBonesPerPartition) {
	    // Build a list of all the bones used by the vertex that aren't currently in this partition  
	    var bonesToAdd = [];
	    var bonesToAddCount = 0;
	    for (var i = 0; i < vertexCount; i++) {
	        for (var influence = 0; influence < 4; influence++) {
	            if (vertices[i]["vertex_boneWeights"][influence] > 0.0 ) {
	                var boneIndex = vertices[i]["vertex_boneIndices"][influence];  
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
	    if ((this.boneIndices.length + bonesToAddCount) > maxBonesPerPartition) {
	        return false;  
	    }  
	
	    // Add bones  
	    for (var i = 0; i < bonesToAddCount; i++) {
	        this.boneIndices.push(bonesToAdd[i]);
	    }
	
	    // Add vertices and indices
	    for (var i = 0; i < vertexCount; i++) {  
	        this.addVertex(vertices[i], vertexIndices[i] );  
	    }
	
	    return true;
	};
	
	SkinPartition.prototype.getBoneRemap = function (boneIndex) {
	    for (var i = 0; i < this.boneIndices.length; i++ ) {
	        if (this.boneIndices[i] === boneIndex) {
	            return i;
	        }  
	    }  
	    return -1;  
	}; 

	SkinPartition.prototype.clear = function () {
	    this.vertices = {};
	//    this.indices = [];
	    this.indexMap = [];  
	};
	

	return {
		ModelResourceHandler: ModelResourceHandler,
		ModelRequest: ModelRequest
	}
}());
