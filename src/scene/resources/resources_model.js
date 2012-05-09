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

        var uri = new pc.URI(url)
        var ext = pc.path.getExtension(uri.path);
        options.binary = (ext === '.model');

        pc.net.http.get(url, function (response) {
            success(response, options);
        }.bind(this), {
            cache: false
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

        if (options.binary) {
            model = this._loadModelBin(data, options);
        } else {
            model = this._loadModelJson(data, options);
        }
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

    ModelResourceHandler.prototype._loadGeometry = function(model, modelData, geomData, buffers) {
        var geometry = new pc.scene.Geometry();
    
        // Skinning data
        if (geomData.inverse_bind_pose !== undefined) {
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

        if (geometry.isSkinned()) {
            var device = pc.gfx.Device.getCurrent();
            var maxBones = device.getBoneLimit();
            if (geometry.getInverseBindPose().length > maxBones) {
                geometry.partitionSkin(maxBones);
            }
        }

        return geometry;
    };

    /**
    * @function
    * @name pc.resources.ModelResourceHandler#_loadModelJson
    * @description Load a pc.scene.Model from data in the PlayCanvas JSON format
    * @param {Object} json The data
    */
    ModelResourceHandler.prototype._loadModelJson = function (data, options) {
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

        if (modelData.materials) {
            var materials = model.getMaterials();
            for (i = 0; i < modelData.materials.length; i++) {
                var materialData = modelData.materials[i];
                materials.push(this._loadMaterial(model, modelData, materialData));
            }
        }

        var geometries = model.getGeometries();
        for (i = 0; i < modelData.geometries.length; i++) {
            var geomData = modelData.geometries[i];
            geometries.push(this._loadGeometry(model, modelData, geomData));
        }
    
        var _jsonToLoader = {
            "camera" : this._loadCamera.bind(this),
            "light"  : this._loadLight.bind(this),
            "mesh"   : this._loadMesh.bind(this),
            "node"   : this._loadNode.bind(this)
        };
    
        var _loadHierarchy = function (nodeData) {
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
        }.bind(this);

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

    ///////////////////
    // BINARY LOADER //
    ///////////////////

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
        var hasNormals = (srcAttribs & attribs.NORMAL) !== 0;
        var hasUvs = (srcAttribs & attribs.UV0) !== 0;
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

    function generateTangentsInPlace(vertexBuffer, indexBuffer) {
        var indices = new Uint16Array(indexBuffer.lock());
        var vertices = vertexBuffer.lock();
        var vertexFormat = vertexBuffer.getFormat();

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

        if (!(positions && normals && uvs)) return;

        var triangleCount = indices.length / 3;
        var vertexCount   = vertices.byteLength / stride;
        var i1, i2, i3;
        var v1, v2, v3;
        var w1, w2, w3;
        var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
        var sdir = pc.math.vec3.create(0, 0, 0);
        var tdir = pc.math.vec3.create(0, 0, 0);
        var v1   = pc.math.vec3.create(0, 0, 0);
        var v2   = pc.math.vec3.create(0, 0, 0);
        var v3   = pc.math.vec3.create(0, 0, 0);
        var w1   = pc.math.vec2.create(0, 0);
        var w2   = pc.math.vec2.create(0, 0);
        var w3   = pc.math.vec2.create(0, 0);
        var i; // Loop counter
        var tan1 = new Float32Array(vertexCount * 3);
        var tan2 = new Float32Array(vertexCount * 3);

        for (i = 0; i < triangleCount; i++) {
            i1 = indices[i * 3];
            i2 = indices[i * 3 + 1];
            i3 = indices[i * 3 + 2];

            pc.math.vec3.set(v1, positions[i1 * (stride / 4)], positions[i1 * (stride / 4) + 1], positions[i1 * (stride / 4) + 2]);
            pc.math.vec3.set(v2, positions[i2 * (stride / 4)], positions[i2 * (stride / 4) + 1], positions[i2 * (stride / 4) + 2]);
            pc.math.vec3.set(v3, positions[i3 * (stride / 4)], positions[i3 * (stride / 4) + 1], positions[i3 * (stride / 4) + 2]);

            pc.math.vec2.set(w1, uvs[i1 * (stride / 4)], uvs[i1 * (stride / 4) + 1]);
            pc.math.vec2.set(w2, uvs[i2 * (stride / 4)], uvs[i2 * (stride / 4) + 1]);
            pc.math.vec2.set(w3, uvs[i3 * (stride / 4)], uvs[i3 * (stride / 4) + 1]);

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
            pc.math.vec3.set(sdir, (t2 * x1 - t1 * x2) * r, 
                                   (t2 * y1 - t1 * y2) * r,
                                   (t2 * z1 - t1 * z2) * r);
            pc.math.vec3.set(tdir, (s1 * x2 - s2 * x1) * r,
                                   (s1 * y2 - s2 * y1) * r,
                                   (s1 * z2 - s2 * z1) * r);

            tan1[i1 * 3 + 0] += sdir[0];
            tan1[i1 * 3 + 1] += sdir[1];
            tan1[i1 * 3 + 2] += sdir[2];
            tan1[i2 * 3 + 0] += sdir[0];
            tan1[i2 * 3 + 1] += sdir[1];
            tan1[i2 * 3 + 2] += sdir[2];
            tan1[i3 * 3 + 0] += sdir[0];
            tan1[i3 * 3 + 1] += sdir[1];
            tan1[i3 * 3 + 2] += sdir[2];

            tan2[i1 * 3 + 0] += tdir[0];
            tan2[i1 * 3 + 1] += tdir[1];
            tan2[i1 * 3 + 2] += tdir[2];
            tan2[i2 * 3 + 0] += tdir[0];
            tan2[i2 * 3 + 1] += tdir[1];
            tan2[i2 * 3 + 2] += tdir[2];
            tan2[i3 * 3 + 0] += tdir[0];
            tan2[i3 * 3 + 1] += tdir[1];
            tan2[i3 * 3 + 2] += tdir[2];
        }

        var n    = pc.math.vec3.create(0, 0, 0);
        var t1   = pc.math.vec3.create(0, 0, 0);
        var t2   = pc.math.vec3.create(0, 0, 0);
        var temp = pc.math.vec3.create(0, 0, 0);

        for (i = 0; i < vertexCount; i++) {
            pc.math.vec3.set(n, normals[i * (stride / 4)], normals[i * (stride / 4) + 1], normals[i * (stride / 4) + 2]);
            pc.math.vec3.set(t1, tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
            pc.math.vec3.set(t2, tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);

            // Gram-Schmidt orthogonalize
            var ndott = pc.math.vec3.dot(n, t1);
            pc.math.vec3.scale(n, ndott, temp);
            pc.math.vec3.subtract(t1, temp, temp);
            pc.math.vec3.normalize(temp, temp);

            tangents[i * (stride / 4)]     = temp[0];
            tangents[i * (stride / 4) + 1] = temp[1];
            tangents[i * (stride / 4) + 2] = temp[2];

            // Calculate handedness
            pc.math.vec3.cross(n, t1, temp);
            tangents[i * (stride / 4) + 3] = (pc.math.vec3.dot(temp, t2) < 0.0) ? -1.0 : 1.0;
        }

        indexBuffer.unlock();
        vertexBuffer.unlock();
    }

    function MemoryStream(arrayBuffer, loader, options) {
        this.memory = arrayBuffer;
        this.dataView = new DataView(arrayBuffer);
        this.filePointer = 0;
        this.options = options;
        this.loader = loader;
    };

    MemoryStream.prototype = {

        // Basic type reading
        readF32: function (count) {
            count = count || 1;
            var data;
            if (count === 1) {
                data = this.dataView.getFloat32(this.filePointer, true);
            } else {
                data = new Float32Array(this.memory, this.filePointer, count);
            }
            this.filePointer += 4 * count;
            return data;
        },

        readU8: function (count) {
            count = count || 1;
            var data;
            if (count === 1) {
                data = this.dataView.getUint8(this.filePointer, true);
            } else {
                data = new Uint8Array(this.memory, this.filePointer, count);
            }
            this.filePointer += 1 * count;
            return data;
        },

        readU16: function (count) {
            count = count || 1;
            var data;
            if (count === 1) {
                data = this.dataView.getUint16(this.filePointer, true);
            } else {
                data = new Uint16Array(this.memory, this.filePointer, count);
            }
            this.filePointer += 2 * count;
            return data;
        },

        readU32: function (count) {
            count = count || 1;
            var data;
            if (count === 1) {
                data = this.dataView.getUint32(this.filePointer, true);
            } else {
                data = new Uint32Array(this.memory, this.filePointer, count);
            }
            this.filePointer += 4 * count;
            return data;
        },

        readString: function (length) {
            var str = "";
            for (var i = 0; i < length; i++) {
                var charCode = this.dataView.getUint8(this.filePointer++);
                str += String.fromCharCode(charCode);
            }
            return str;
        },

        // Chunk reading
        readChunkHeader: function () {
            var magic = this.readString(4);
            var version = this.readU32();
            var length = this.readU32();
            return {
                magic: magic,
                version: version,
                length: length
            };
        },

        readStringChunk: function () {
            var header = this.readChunkHeader();
            var str = this.readString(header.length);

            // Read to the next 4 byte boundary
            while (this.filePointer % 4 !== 0) {
                this.filePointer++;
            }
            return str;
        },

        readTextureChunk: function () {
            var header    = this.readChunkHeader();
            var name      = this.readStringChunk();
            var filename  = this.readStringChunk();
            var addrModeU = this.readU8();
            var addrModeV = this.readU8();
            var filterMin = this.readU8();
            var filterMax = this.readU8();
            var transform = pc.math.mat4.create();
            for (var i = 0; i < 16; i++) {
                transform[i] = this.readF32();
            }

            var texture = new pc.gfx.Texture2D();

            var url = this.options.directory + "/" + filename;

            // Make a new request for the Image resource at the same priority as the Model was requested.
            this.loader.request([new pc.resources.ImageRequest(url)], this.options.priority, function (resources) {
                texture.setSource(resources[url]);	
            }, function (errors, resources) {
                Object.keys(errors).forEach(function (key) {
                   logERROR(errors[key]);    
                });
            }, function (progress) {
                // no progress features
            }, this.options);

            texture.setName(name);
            texture.setAddressMode(addrModeU, addrModeV);
            texture.setFilterMode(filterMin, filterMax);
            texture.transform = transform;

            return texture;
        },

        readMaterialParamChunk: function () {
            var header = this.readChunkHeader();
            var name   = this.readStringChunk();
            var type   = this.readU32();
            var data;
            switch (type) {
                case pc.gfx.ShaderInputType.FLOAT:
                    data = this.readF32();
                    break;
                case pc.gfx.ShaderInputType.VEC2:
                    var x = this.readF32();
                    var y = this.readF32();
                    data = pc.math.vec2.create(x, y);
                    break;
                case pc.gfx.ShaderInputType.VEC3:
                    var x = this.readF32();
                    var y = this.readF32();
                    var z = this.readF32();
                    data = pc.math.vec3.create(x, y, z);
                    break;
                case pc.gfx.ShaderInputType.VEC4:
                    var x = this.readF32();
                    var y = this.readF32();
                    var z = this.readF32();
                    var w = this.readF32();
                    data = pc.math.vec4.create(x, y, z, w);
                    break;
                case pc.gfx.ShaderInputType.TEXTURE2D:
                    data = this.model.getTextures()[this.readU32()];
                    break;
            }
            return {
                name: name,
                data: data
            };
        },

        readMaterialChunk: function () {
            var header    = this.readChunkHeader();
            var name      = this.readStringChunk();
            var shader    = this.readStringChunk();
            var numParams = this.readU32();

            var material = new pc.scene.Material();
            material.setName(name);
            material.setProgramName(shader);

            // Read each shader parameter
            for (var i = 0; i < numParams; i++) {
                var param = this.readMaterialParamChunk();
                material.setParameter(param.name, param.data);
                if (param.name.substring(0, 'texture_'.length) === 'texture_') {
                    var texture = param.data;
                    if (texture.transform === undefined) {
                        material.setParameter(param.name + "Transform", pc.math.mat4.create());
                    } else {
                        material.setParameter(param.name + "Transform", pc.math.mat4.create(texture.transform));
                    }
                }
            }

            return material;
        },

        readAabbChunk: function () {
            var header = this.readChunkHeader();
            var minx = this.readF32();
            var miny = this.readF32();
            var minz = this.readF32();
            var maxx = this.readF32();
            var maxy = this.readF32();
            var maxz = this.readF32();

            var center = pc.math.vec3.create((maxx + minx) * 0.5, (maxy + miny) * 0.5, (maxz + minz) * 0.5);
            var halfExtents = pc.math.vec3.create((maxx - minx) * 0.5, (maxy - miny) * 0.5, (maxz - minz) * 0.5);
            return new pc.shape.Aabb(center, halfExtents);
        },

        readVertexBufferChunk: function () {
            var header = this.readChunkHeader();
            var format = this.readU32();
            var count  = this.readU32();
            var stride = this.readU32();

            // Create the vertex buffer format
            var vertexFormat = translateFormat(format);

            var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, count);
            var vbuff = vertexBuffer.lock();
            var dst = new Uint8Array(vbuff);
            var src = this.readU8(count * stride);
            copyToBuffer(dst, src, format, stride);
            vertexBuffer.unlock();
            
            return vertexBuffer;
        },

        readIndexBufferChunk: function () {
            var header = this.readChunkHeader();
            var type = this.readU32();
            var numIndices = this.readU32();

            var indexBuffer = new pc.gfx.IndexBuffer(type, numIndices);
            var ibuff = indexBuffer.lock();
            var src, dst;
            if (type === pc.gfx.IndexFormat.UINT8) {
                src = this.readU8(numIndices);
                dst = new Uint8Array(ibuff);
            } else {
                src = this.readU16(numIndices);
                dst = new Uint16Array(ibuff);
            }
            dst.set(src);
            indexBuffer.unlock();

            // Read to the next 4 byte boundary
            while (this.filePointer % 4 !== 0) {
                this.filePointer++;
            }

            return indexBuffer;
        },

        readSubMeshesChunk: function () {
            var header = this.readChunkHeader();
            var numSubMeshes = this.readU32();

            var subMeshes = [];
            for (var i = 0; i < numSubMeshes; i++) {
                var matIndex = this.readU16();
                var primType = this.readU8();
                var indexed  = this.readU8();
                var base     = this.readU32();
                var count    = this.readU32();

                subMeshes.push({
                    material: this.model.getMaterials()[matIndex],
                    primitive: {
                        type: primType,
                        indexed: indexed === 1,
                        base: base,
                        count: count
                    }
                });
            }
            return subMeshes;
        },

        readGeometryChunk: function () {
            var header = this.readChunkHeader();

            var bbox = this.readAabbChunk();
            var vbuff = this.readVertexBufferChunk();
            var ibuff = this.readIndexBufferChunk();
            var subMeshes = this.readSubMeshesChunk();
            var numBones  = this.readU32();
            var ibp = [];
            var boneNames = [];
            if (numBones > 0) {
                for (var i = 0; i < numBones; i++) {
                    var ibm = pc.math.mat4.create();
                    for (var j = 0; j < 16; j++) {
                        ibm[j] = this.readF32();
                    }
                    ibp.push(ibm);
                }
                for (var i = 0; i < numBones; i++) {
                    var boneName = this.readStringChunk();
                    boneNames.push(boneName);
                }
            }

            generateTangentsInPlace(vbuff, ibuff);

            var geometry = new pc.scene.Geometry();
            geometry.setAabb(bbox);
            geometry.setIndexBuffer(ibuff);
            geometry.setVertexBuffers([vbuff]);
            geometry.setSubMeshes(subMeshes);
            if (numBones > 0) {
                geometry.setInverseBindPose(ibp);
                geometry._boneNames = boneNames;
            }

            if (geometry.isSkinned()) {
                var device = pc.gfx.Device.getCurrent();
                var maxBones = device.getBoneLimit();
                if (geometry.getInverseBindPose().length > maxBones) {
                    geometry.partitionSkin(maxBones);
                }
            }

            return geometry;
        },

        readNodeChunk: function () {
            var header = this.readChunkHeader();

            // Read the GraphNode properties
            var nodeType  = this.readU32();
            var name      = this.readStringChunk();
            var transform = pc.math.mat4.create();
            for (var i = 0; i < 16; i++) {
                transform[i] = this.readF32();
            }

            var node;
            switch (nodeType) {
                case 0: // GraphNode
                    node = new pc.scene.GraphNode();
                    node.setName(name);
                    node.setLocalTransform(transform);
                    break;
                case 1: // Camera
                    node = new pc.scene.CameraNode();
                    node.setName(name);
                    node.setLocalTransform(transform);

                    var projection = this.readU32();
                    var nearClip = this.readF32();
                    var farClip = this.readF32();
                    var fov = this.readF32();
                    var r = this.readF32();
                    var g = this.readF32();
                    var b = this.readF32();
                    var a = this.readF32();

                    node.setProjection(projection);
                    node.setNearClip(nearClip);
                    node.setFarClip(farClip);
                    node.setFov(fov);
                    var clearColor = node.getClearOptions().color;
                    clearColor[0] = r;
                    clearColor[1] = g;
                    clearColor[2] = b;
                    clearColor[3] = a;

                    this.model.getCameras().push(node);
                    break;
                case 2: // Light
                    node = new pc.scene.LightNode();
                    node.setName(name);
                    node.setLocalTransform(transform);

                    var type = this.readU16();
                    var enabled = this.readU8();
                    var castShadows = this.readU8();
                    var r = this.readF32();
                    var g = this.readF32();
                    var b = this.readF32();
                    var intensity = this.readF32();
                    var attStart = this.readF32();
                    var attEnd = this.readF32();
                    var innerConeAngle = this.readF32();
                    var outerConeAngle = this.readF32();

                    node.setType(type);
                    node.setEnabled(enabled);
                    node.setCastShadows(castShadows);
                    node.setColor(r, g, b);
                    node.setIntensity(intensity);
                    node.setAttenuationStart(attStart);
                    node.setAttenuationEnd(attEnd);
                    node.setInnerConeAngle(innerConeAngle);
                    node.setOuterConeAngle(outerConeAngle);

                    this.model.getLights().push(node);
                    break;
                case 3: // Mesh
                    node = new pc.scene.MeshNode();
                    node.setName(name);
                    node.setLocalTransform(transform);

                    // Mesh specific properties
                    var geomIndex = this.readU32();
                    node.setGeometry(this.model.getGeometries()[geomIndex]);

                    this.model.getMeshes().push(node);
                    break;
            }
            
            return node;
        },

        readModelChunk: function () {
            var i;
            this.model = new pc.scene.Model();

            var header = this.readChunkHeader();

            // Get the model stats
            var numTextures   = this.readU16();
            var numMaterials  = this.readU16();
            var numGeometries = this.readU16();
            var numNodes      = this.readU16();

            // Read the texture array
            var textures = this.model.getTextures();
            for (i = 0; i < numTextures; i++) {
                textures.push(this.readTextureChunk());
            }

            // Read the material array
            var materials = this.model.getMaterials();
            for (i = 0; i < numMaterials; i++) {
                materials.push(this.readMaterialChunk());
            }

            // Read the geometry array
            var geometries = this.model.getGeometries();
            for (i = 0; i < numGeometries; i++) {
                geometries.push(this.readGeometryChunk());
            }

            // Read the node array
            var nodes = [];
            for (i = 0; i < numNodes; i++) {
                nodes.push(this.readNodeChunk());
            }

            // Read the hierarchy
            var numConnections = numNodes - 1;
            var connections = this.readU16(numConnections * 2);
            for (i = 0; i < numConnections; i++) {
                var parent = connections[i * 2];
                var child  = connections[i * 2 + 1];
                nodes[parent].addChild(nodes[child]);
            }
            this.model.setGraph(nodes[0]);

            // Resolve bone IDs to actual graph nodes
            var meshes = this.model.getMeshes();
            var graph = this.model.getGraph();
            for (i = 0; i < meshes.length; i++) {
                var mesh = meshes[i];
                var geom = mesh.getGeometry();
                if (geom._boneNames !== undefined) {
                    mesh._bones = [];
                    for (var j = 0; j < geom._boneNames.length; j++) {
                        var boneName = geom._boneNames[j];
                        var bone = graph.findByName(boneName);
                        mesh._bones.push(bone);
                    }
                }
            }

            return this.model;
        }
    };

    ModelResourceHandler.prototype._loadModelBin = function (data, options) {
        var stream = new MemoryStream(data, this._loader, options);
        return stream.readModelChunk();
    };
    
	var ModelRequest = function ModelRequest(identifier) {		
	};
	ModelRequest = ModelRequest.extendsFrom(pc.resources.ResourceRequest);
    ModelRequest.prototype.type = "model";

	return {
		ModelResourceHandler: ModelResourceHandler,
		ModelRequest: ModelRequest
	}
}());
