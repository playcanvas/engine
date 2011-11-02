pc.extend(pc.resources, function () {
	/**
	 * @name pc.resources.ModelResourceHandler
	 * @description Resource Handler for creating pc.scene.Model resources
	 */
	var ModelResourceHandler = function () {
        this._jsonToPrimitiveType = {
            "pointlist": pc.gfx.PrimType.POINTS,
            "linelist":  pc.gfx.PrimType.LINES,
            "linestrip": pc.gfx.PrimType.LINE_STRIP,
            "trilist":   pc.gfx.PrimType.TRIANGLES,
            "tristrip":  pc.gfx.PrimType.TRIANGLE_STRIP
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
            "repeat":          pc.gfx.TextureAddress.REPEAT,
            "clamp":           pc.gfx.TextureAddress.CLAMP_TO_EDGE,
            "mirrored_repeat": pc.gfx.TextureAddress.MIRRORED_REPEAT
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

        pc.net.http.get(url, function (response) {
	        try {
    	    	//var model = this.open(response, options)
    	    	success(response, options);
	        } catch (e) {
	            error(pc.string.format("An error occured while loading model from: '{0}'", url));
	        }
        }.bind(this), {
            cache:false
        });
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
    
        // Light properties
        var type = this._jsonToLightType[lightData.light_type];
        light.setType(type);
        light.setAmbient(lightData.ambient);
        light.setDiffuse(lightData.diffuse);
    
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
                    material.setParameter(param.name + "Transform", [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
                } else {
                    material.setParameter(param.name + "Transform", texture.transform);
                }
            } else {
                material.setParameter(param.name, param.data);
            }
        }
    
        return material;
    };
    
    ModelResourceHandler.prototype._loadSubMesh = function (model, modelData, subMeshData) {
        // Translate the primitive type
        var primitiveType = this._jsonToPrimitiveType[subMeshData.primitive.type];
        
        // Create the index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, subMeshData.primitive.indices.length);
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(subMeshData.primitive.indices);
        indexBuffer.unlock();
    
        // Look up the material
        var material = model.getMaterials()[subMeshData.material];
        if (material === undefined) {
            logERROR("Material " + subMeshData.material + " not found in model's material dictionary.");
        }
    
        var subMesh = new pc.scene.SubMesh();
        subMesh.setMaterial(material);
        subMesh.setIndexBuffer(indexBuffer);
        subMesh.setPrimitiveType(primitiveType);
        if (subMeshData.boneIndices) {
            subMesh._boneIndices = subMeshData.boneIndices;
            subMesh._subPalette = new Float32Array(subMesh._boneIndices.length * 16);
        }
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
	    for (iSubMesh = 0; iSubMesh < geometryData.submeshes.length; iSubMesh++) {
	        var subMesh = geometryData.submeshes[iSubMesh];
	        var indexList = subMesh.primitive.indices;
	        var indexEnd = indexList.length;
	        for (var iIndex = 0; iIndex < indexEnd; ) {  
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
	                partition.material = subMesh.material;
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
	    for (var iPartition = 0; iPartition < partitions.length; iPartition++) {
	        var subMesh = {};
	        var partition = partitions[iPartition];
	        subMesh.material = partition.material;
	        subMesh.primitive = {
	            "type": "trilist",
	            "indices": partitionedIndices.splice(0, partition.indexCount)
	        };
	        subMesh.boneIndices = partition.boneIndices;
	        subMeshes.push(subMesh);
	    }
	    geometryData.submeshes = subMeshes;
	};
	
    ModelResourceHandler.prototype._loadGeometry = function(model, modelData, geomData) {
        var geometry = new pc.scene.Geometry();
    
        // Skinning data
        if (geomData.inverse_bind_pose !== undefined) {
            var device = pc.gfx.Device.getCurrent();
            var maxBones = device.getBoneLimit();
            if (geomData.inverse_bind_pose.length > maxBones) {
                this._partitionSkinnedGeometry(geomData, maxBones);
            }
    
            var inverseBindPose = [];
            for (var i = 0; i < geomData.inverse_bind_pose.length; i++) {
                inverseBindPose[i] = pc.math.mat4.clone(geomData.inverse_bind_pose[i]);
            }
            geometry.setInverseBindPose(inverseBindPose);
    
            geometry._boneIds = geomData.bone_ids;
        }
    
        // Calculate tangents if we have positions, normals and texture coordinates
        var positions = null, normals = null, uvs = null;
        for (var i = 0; i < geomData.attributes.length; i++) {
            var entry = geomData.attributes[i];
    
            if (entry.name === "vertex_position") {
                // Calculate a bounding sphere for the geometry
                var sphere = new pc.shape.Sphere();
                sphere.compute(entry.data);
                geometry.setVolume(sphere);
    
                positions = entry.data;
            }
            if (entry.name === "vertex_normal") {
                normals = entry.data;
            }
            if (entry.name === "vertex_texCoord0") {
                uvs = entry.data;
            }
        }
    
        if (positions && normals && uvs) {
            var indices = [];
            for (var i = 0; i < geomData.submeshes.length; i++) {
                indices = indices.concat(geomData.submeshes[i].primitive.indices);
            }
            var tangents = pc.graph.procedural.calculateTangents(positions, normals, uvs, indices);
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
    
        // Create and read each submesh
        for (var i = 0; i < geomData.submeshes.length; i++) {
            var subMesh = this._loadSubMesh(model, modelData, geomData.submeshes[i]);
    
            geometry.getSubMeshes().push(subMesh);
        }
    
        return geometry;
    };
    
    /**
    * @function
    * @name pc.resources.ModelResourceHandler#_loadModel
    * @description Load a pc.scene.Model from data in the PlayCanvas JSON format
    * @param {Object} json The data
    */
    ModelResourceHandler.prototype._loadModel = function (json, options) {
        var model = new pc.scene.Model();
        var i;
    
        // Load in the shared resources of the model (textures, materials and geometries)
        if (json.textures) {
            var textures = model.getTextures();
            for (i = 0; i < json.textures.length; i++) {
                var textureData = json.textures[i];
                textures.push(this._loadTexture(model, json, textureData, options));
            }
        }
        
        var materials = model.getMaterials();
        for (i = 0; i < json.materials.length; i++) {
            var materialData = json.materials[i];
            materials.push(this._loadMaterial(model, json, materialData));
        }
    
        var geometries = model.getGeometries();
        for (i = 0; i < json.geometries.length; i++) {
            var geomData = json.geometries[i];
            geometries.push(this._loadGeometry(model, json, geomData));
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
                node = loadFunc(model, json, nodeData);
    
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
        
        if (json.graph !== undefined) {
            var graph = _loadHierarchy(json.graph);
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
