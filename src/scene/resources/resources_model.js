pc.extend(pc.resources, function () {
	/**
	 * @name pc.resources.ModelResourceHandler
	 * @class Resource Handler for creating pc.scene.Model resources
	 */
	var ModelResourceHandler = function (device, assetRegistry) {
        this._device = device;
        this._assets = assetRegistry;

        this._jsonToPrimitiveType = {
            "points":         pc.gfx.PRIMITIVE_POINTS,
            "lines":          pc.gfx.PRIMITIVE_LINES,
            "linestrip":      pc.gfx.PRIMITIVE_LINESTRIP,
            "triangles":      pc.gfx.PRIMITIVE_TRIANGLES,
            "trianglestrip":  pc.gfx.PRIMITIVE_TRISTRIP
        };

        this._jsonToVertexElementType = {
            "int8":     pc.gfx.ELEMENTTYPE_INT8,
            "uint8":    pc.gfx.ELEMENTTYPE_UINT8,
            "int16":    pc.gfx.ELEMENTTYPE_INT16,
            "uint16":   pc.gfx.ELEMENTTYPE_UINT16,
            "int32":    pc.gfx.ELEMENTTYPE_INT32,
            "uint32":   pc.gfx.ELEMENTTYPE_UINT32,
            "float32":  pc.gfx.ELEMENTTYPE_FLOAT32
        };

        this._jsonToLightType = {
            "directional": pc.scene.LightType.DIRECTIONAL,
            "point":       pc.scene.LightType.POINT,
            "spot":        pc.scene.LightType.SPOT
        };
        
        this._jsonToAddressMode = {
            "repeat": pc.gfx.ADDRESS_REPEAT,
            "clamp":  pc.gfx.ADDRESS_CLAMP_TO_EDGE,
            "mirror": pc.gfx.ADDRESS_MIRRORED_REPEAT
        };
        
        this._jsonToFilterMode = {
            "nearest":             pc.gfx.FILTER_NEAREST,
            "linear":              pc.gfx.FILTER_LINEAR,
            "nearest_mip_nearest": pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST,
            "linear_mip_nearest":  pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST,
            "nearest_mip_linear":  pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR,
            "linear_mip_linear":   pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
        };
        
        this._jsonToProjectionType = {
            "perspective"  : pc.scene.Projection.PERSPECTIVE,
            "orthographic" : pc.scene.Projection.ORTHOGRAPHIC
        };
	};
	ModelResourceHandler = pc.inherits(ModelResourceHandler, pc.resources.ResourceHandler);
	
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
    ModelResourceHandler.prototype.load = function (request, options) {

        var promise = new RSVP.Promise(function (resolve, reject) {
            var url = request.canonical;
            options = options || {};
            options.directory = pc.path.getDirectory(url);

            var uri = new pc.URI(url);
            var ext = pc.path.getExtension(uri.path);
            
            pc.net.http.get(url, function (response) {
                resolve(response);
            }.bind(this), {
                cache: false,
                error: function (status, xhr, e) {
                    reject(pc.string("Error loading model: {0} [{1}]", url, status));
                }
            });
        });

        return promise;
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
    ModelResourceHandler.prototype.open = function (data, request, options) {
        options = options || {};
        options.directory = options.directory || "";
        options.parent = request; // the model request is used as the parent for any texture requests

        var binary = pc.path.getExtension(request.canonical) === '.model';
        if (binary) {
            model = null;
            logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", request.canonical));
        } else {
            if (data.model.version <= 1) {
                model = null;
                logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", request.canonical));
            } else {
                model = this._loadModelJsonV2(data, request.data, options);
            }
        }

        return model;
    };

    ModelResourceHandler.prototype.clone = function (model) {
        return model.clone();
    };

    ModelResourceHandler.prototype._setNodeData = function (node, data) {
        node.setName(data.name);
        node.addGraphId(data.uid);
        if (data.transform) {
            // Backwards compatibility code. Remove at some point...
            var p = pc.math.mat4.getTranslation(data.transform);
            var r = pc.math.mat4.toEulerXYZ(data.transform);
            var s = pc.math.mat4.getScale(data.transform);
            node.setLocalPosition(p);
            node.setLocalEulerAngles(r);
            node.setLocalScale(s);
        } else {
            node.setLocalPosition(data.position);
            node.setLocalEulerAngles(data.rotation);
            node.setLocalScale(data.scale);
        }
    },

    ModelResourceHandler.prototype._loadNode = function (model, modelData, nodeData) {
        var node = new pc.scene.GraphNode();

        this._setNodeData(node, nodeData);

        return node;
    };
    
    ModelResourceHandler.prototype._loadCamera = function (model, modelData, cameraData) {
        var camera = new pc.scene.CameraNode();

        this._setNodeData(camera, cameraData);

        // Camera properties
        var projection = this._jsonToProjectionType[cameraData.projection];
        camera.setProjection(projection);
        camera.setNearClip(cameraData.nearClip);
        camera.setFarClip(cameraData.farClip);
        camera.setFov(cameraData.fov);
        camera.setClearOptions({
            color: cameraData.clearColor || [0, 0, 0, 1],
            depth: 1,
            flags: pc.gfx.CLEARFLAG_COLOR | pc.gfx.CLEARFLAG_DEPTH
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

        this._setNodeData(light, lightData);

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
        var node = new pc.scene.GraphNode();

        this._setNodeData(node, meshData);

        // Mesh properties
        var geometryId = meshData.geometry;
        var geometry   = model.geometries[geometryId];

        for (var i = 0; i < geometry.length; i++) {
            var meshInstance = new pc.scene.MeshInstance(node, geometry[i], geometry[i]._material);
            if (geometry[i].skin) {
                var skinIndex = model.skins.indexOf(geometry[i].skin);
                meshInstance.skinInstance = model.skinInstances[skinIndex];
            }
            model.meshInstances.push(meshInstance);
        }
        return node;
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
     * @param [options.parent] An existing request to add the texture request to 
     */
    ModelResourceHandler.prototype._loadTexture = function (model, modelData, textureData, options) {
        var url = options.directory + "/" + textureData.uri;
        
        var texture = null;
        if (this._textureCache) {
            texture = this._textureCache.getTexture(url);
        }

        // Texture not in cache, we need to create a new one and load it.
        if (!texture) {
            var ext = pc.path.getExtension(url);
            var format = (ext === '.png') ? pc.gfx.PIXELFORMAT_R8_G8_B8_A8 : pc.gfx.PIXELFORMAT_R8_G8_B8;
            texture = new pc.gfx.Texture(this._device, {
                format: format
            });
            texture.name = textureData.name;
            texture.addressU = this._jsonToAddressMode[textureData.addressu];
            texture.addressV = this._jsonToAddressMode[textureData.addressv];
            texture.magFilter = this._jsonToFilterMode[textureData.magfilter];
            texture.minFilter = this._jsonToFilterMode[textureData.minfilter];

            // add to textureCache cache
            if (this._textureCache) {
                this._textureCache.addTexture(url, texture);
            }
            
            // Make a new request for the Image resource
            var promise = this._loader.request(new pc.resources.ImageRequest(url), options);
            promise.then(function (resources) {
                texture.setSource(resources[0]);
            });
        }

        return texture;
    };
    
    ModelResourceHandler.prototype._loadMaterial = function(model, modelData, materialData) {
        var material = new pc.scene.PhongMaterial();
        material.name = materialData.name;

        // Read each shader parameter
        for (var i = 0; i < materialData.parameters.length; i++) {
            var param = materialData.parameters[i];
            switch (param.name) {
                case 'material_ambient': 
                    material.ambient = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_diffuse': 
                    material.diffuse = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_diffuseMap': 
                    material.diffuseMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_diffuseMapTransform': 
                    material.diffuseMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_specular': 
                    material.specular = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_specularMap': 
                    material.specularMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_specularMapTransform': 
                    material.specularMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_specularFactorMap':
                    material.specularFactorMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_specularFactorMapTransform': 
                    material.specularFactorMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_shininess':
                    material.shininess = param.data;
                    break;
                case 'texture_glossMap': 
                    material.glossMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_glossMapTransform':
                    material.glossMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_emissive':
                    material.emissive = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_emissiveMap': 
                    material.emissiveMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_emissiveMapTransform': 
                    material.emissiveMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_opacity':
                    material.opacity = param.data;
                    if (material.opacity < 1) {
                        material.blendType = pc.scene.BLEND_NORMAL;
                    }
                    break;
                case 'texture_opacityMap': 
                    material.opacityMap = model.getTextures()[param.data];
                    material.blendType = pc.scene.BLEND_NORMAL;
                    break;
                case 'texture_opacityMapTransform': 
                    material.opacityMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_sphereMap': 
                    material.reflectionMap = model.getTextures()[param.data];
                    break;
                case 'texture_cubeMap': 
                    material.reflectionMap = model.getTextures()[param.data];
                    break;
                case 'material_reflectionFactor':
                    material.reflectivity = param.data;
                    break;
                case 'texture_normalMap': 
                    material.normalMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_normalMapTransform': 
                    material.normalMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'texture_heightMap': 
                    material.heightMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_heightMapTransform': 
                    material.heightMapTransform = pc.math[param.type].clone(param.data); 
                    break;
                case 'material_bumpMapFactor': 
                    material.bumpMapFactor = param.data;
                    break;
                case 'texture_lightMap': 
                    material.lightMap = model.getTextures()[param.data];
                    break;
            }
        }

        material.update();
    
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
        var i;
        var attribute;

        if (pc.gfx.precalculatedTangents) {
            // Calculate tangents if we have positions, normals and texture coordinates
            var positions = null, normals = null, uvs = null, tangents = null;
            for (i = 0; i < geomData.attributes.length; i++) {
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
                tangents = pc.scene.procedural.calculateTangents(positions, normals, uvs, geomData.indices.data);
                geomData.attributes.push({ name: "vertex_tangent", type: "float32", components: 4, data: tangents });
            }
        }

        // Generate the vertex format for the geometry's vertex buffer
        var semantic;
        var semanticMap = {
            vertex_position: pc.gfx.SEMANTIC_POSITION,
            vertex_normal: pc.gfx.SEMANTIC_NORMAL,
            vertex_tangent: pc.gfx.SEMANTIC_TANGENT,
            vertex_color: pc.gfx.SEMANTIC_COLOR,
            vertex_boneIndices: pc.gfx.SEMANTIC_BLENDINDICES,
            vertex_boneWeights: pc.gfx.SEMANTIC_BLENDWEIGHT,
            vertex_texCoord0: pc.gfx.SEMANTIC_TEXCOORD0,
            vertex_texCoord1: pc.gfx.SEMANTIC_TEXCOORD1,
            vertex_texCoord2: pc.gfx.SEMANTIC_TEXCOORD2,
            vertex_texCoord3: pc.gfx.SEMANTIC_TEXCOORD3,
            vertex_texCoord4: pc.gfx.SEMANTIC_TEXCOORD4,
            vertex_texCoord5: pc.gfx.SEMANTIC_TEXCOORD5,
            vertex_texCoord6: pc.gfx.SEMANTIC_TEXCOORD6,
            vertex_texCoord7: pc.gfx.SEMANTIC_TEXCOORD7
        }
        var formatDesc = [];
        for (i = 0; i < geomData.attributes.length; i++) {
            attribute = geomData.attributes[i];

            formatDesc.push({
                semantic: semanticMap[attribute.name],
                components: attribute.components,
                type: this._jsonToVertexElementType[attribute.type],
                normalize: false
            });
        }
        var vertexFormat = new pc.gfx.VertexFormat(this._device, formatDesc);

        // Create the vertex buffer
        var numVertices = geomData.attributes[0].data.length / geomData.attributes[0].components;
        var vertexBuffer = new pc.gfx.VertexBuffer(this._device, vertexFormat, numVertices);

        var iterator = new pc.gfx.VertexIterator(vertexBuffer);
        for (i = 0; i < numVertices; i++) {
            for (var j = 0; j < geomData.attributes.length; j++) {
                attribute = geomData.attributes[j];
                semantic = semanticMap[attribute.name];
                switch (attribute.components) {
                    case 1:
                        iterator.element[semantic].set(attribute.data[i]);
                        break;
                    case 2:
                        iterator.element[semantic].set(attribute.data[i * 2], attribute.data[i * 2 + 1]);
                        break;
                    case 3:
                        iterator.element[semantic].set(attribute.data[i * 3], attribute.data[i * 3 + 1], attribute.data[i * 3 + 2]);
                        break;
                    case 4:
                        iterator.element[semantic].set(attribute.data[i * 4], attribute.data[i * 4 + 1], attribute.data[i * 4 + 2], attribute.data[i * 4 + 3]);
                        break;
                }
            }
            iterator.next();
        }
        iterator.end();
    
        // Create the index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(this._device, pc.gfx.INDEXFORMAT_UINT16, geomData.indices.data.length);
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(geomData.indices.data);
        indexBuffer.unlock();

        // Skinning data
        var skin, skinInstance;
        if (geomData.inverse_bind_pose !== undefined) {
            var inverseBindPose = [];
            for (i = 0; i < geomData.inverse_bind_pose.length; i++) {
                inverseBindPose[i] = pc.math.mat4.clone(geomData.inverse_bind_pose[i]);
            }

            skin = new pc.scene.Skin(inverseBindPose, geomData.bone_ids);
        }

        // Set the local space axis-aligned bounding box of the geometry
        var min = geomData.bbox.min;
        var max = geomData.bbox.max;
        var aabb = new pc.shape.Aabb(
            pc.math.vec3.create((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
            pc.math.vec3.create((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
        );

        var meshes = [];

        // Create and read each submesh
        for (i = 0; i < geomData.submeshes.length; i++) {
            var subMesh = this._loadSubMesh(model, modelData, geomData.submeshes[i]);

            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer[0] = indexBuffer;
            mesh.primitive[0].type = subMesh.primitive.type;
            mesh.primitive[0].base = subMesh.primitive.base;
            mesh.primitive[0].count = subMesh.primitive.count;
            mesh.primitive[0].indexed = true;
            mesh.skin = skin ? skin : null;
            mesh.aabb = aabb;

            mesh._material = subMesh.material;

            meshes.push(mesh);
        }

        if (geomData.inverse_bind_pose !== undefined) {
            var maxBones = this._device.getBoneLimit();
            if (geomData.inverse_bind_pose.length > maxBones) {
                meshes = pc.scene.partitionSkin(this._device, maxBones, [vertexBuffer], indexBuffer, meshes, skin);
            }

            for (i = 0; i < meshes.length; i++) {
                skin = meshes[i].skin;
                var skinIndex = model.skins.indexOf(skin);
                if (skinIndex === -1) {
                    model.skins.push(skin);
                    skinInstance = new pc.scene.SkinInstance(skin);
                    model.skinInstances.push(skinInstance);
                }
            }
        }

        return meshes;
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

        model.geometries = [];
        for (i = 0; i < modelData.geometries.length; i++) {
            var geomData = modelData.geometries[i];
            model.geometries.push(this._loadGeometry(model, modelData, geomData));
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
        };

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
        };

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

            // Need to update JSON file format to have bone names instead of graph IDs
            for (i = 0; i < model.skins.length; i++) {
                var skin = model.skins[i];
                for (var j = 0; j < skin.boneNames.length; j++) {
                    skin.boneNames[j] = graph.findByGraphId(skin.boneNames[j]).getName();
                }
            }

            // Resolve bone IDs to actual graph nodes
            model.resolveBoneNames();

            // Resolve camera aim/up graph node IDs to actual graph nodes            
            _resolveCameraIds(graph);

//            _clearGraphIds(graph);
        }

        model.getGraph().syncHierarchy();

        var meshInstances = model.meshInstances;
        for (i = 0; i < meshInstances.length; i++) {
            meshInstances[i].syncAabb();
        }

        return model;
    };


    /**
    * @function
    * @name pc.resources.ModelResourceHandler#_loadModelJson
    * @description Load a pc.scene.Model from data in the PlayCanvas JSON format
    * @param {Object} json The data
    * @param {Object} mapping An array of mapping data, for each mesh there should be a entry with a 'material' field mapping meshInstance to material asset
    */
    ModelResourceHandler.prototype._loadModelJsonV2 = function (data, mapping, options) {
        var attributeMap = {
            position: pc.gfx.SEMANTIC_POSITION,
            normal: pc.gfx.SEMANTIC_NORMAL,
            tangent: pc.gfx.SEMANTIC_TANGENT,
            blendWeight: pc.gfx.SEMANTIC_BLENDWEIGHT,
            blendIndices: pc.gfx.SEMANTIC_BLENDINDICES,
            color: pc.gfx.SEMANTIC_COLOR,
            texCoord0: pc.gfx.SEMANTIC_TEXCOORD0,
            texCoord1: pc.gfx.SEMANTIC_TEXCOORD1,
            texCoord2: pc.gfx.SEMANTIC_TEXCOORD2,
            texCoord3: pc.gfx.SEMANTIC_TEXCOORD3,
            texCoord4: pc.gfx.SEMANTIC_TEXCOORD4,
            texCoord5: pc.gfx.SEMANTIC_TEXCOORD5,
            texCoord6: pc.gfx.SEMANTIC_TEXCOORD6,
            texCoord7: pc.gfx.SEMANTIC_TEXCOORD7
        };

        var modelData = data.model;
        var i, j;

        var nodes = [];
        for (i = 0; i < modelData.nodes.length; i++) {
            var nodeData = modelData.nodes[i];

            var node = new pc.scene.GraphNode();
            node.setName(nodeData.name);
            node.setLocalPosition(nodeData.position);
            node.setLocalEulerAngles(nodeData.rotation);
            node.setLocalScale(nodeData.scale);

            nodes.push(node);
        }

        for (i = 1; i < modelData.parents.length; i++) {
            nodes[modelData.parents[i]].addChild(nodes[i]);
        }

        var skins = [];
        for (i = 0; i < modelData.skins.length; i++) {
            var skinData = modelData.skins[i];

            var inverseBindMatrices = [];
            for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                inverseBindMatrices[j] = pc.math.mat4.clone(skinData.inverseBindMatrices[j]);
            }

            var skin = new pc.scene.Skin(inverseBindMatrices, skinData.boneNames);
            skins.push(skin);
        }

        var vertexBuffers = [];
        var attribute, attributeName;
        for (i = 0; i < modelData.vertices.length; i++) {
            var vertexData = modelData.vertices[i];

            // Check to see if we need to generate tangents
            if (vertexData.position && vertexData.normal && vertexData.texCoord0) {
                var indices = [];
                for (j = 0; j < modelData.meshes.length; j++) {
                    if (modelData.meshes[j].vertices === i) {
                        indices = indices.concat(modelData.meshes[j].indices);
                    }
                }
                tangents = pc.scene.procedural.calculateTangents(vertexData.position.data, vertexData.normal.data, vertexData.texCoord0.data, indices);
                vertexData.tangent = { type: "float32", components: 4, data: tangents };
            }

            var formatDesc = [];
            for(attributeName in vertexData) {
                attribute = vertexData[attributeName];

                formatDesc.push({
                    semantic: attributeMap[attributeName],
                    components: attribute.components,
                    type: this._jsonToVertexElementType[attribute.type],
                    normalize: false
                });
            }
            var vertexFormat = new pc.gfx.VertexFormat(this._device, formatDesc);

            // Create the vertex buffer
            var numVertices = vertexData.position.data.length / vertexData.position.components;
            var vertexBuffer = new pc.gfx.VertexBuffer(this._device, vertexFormat, numVertices);

            var iterator = new pc.gfx.VertexIterator(vertexBuffer);
            for (j = 0; j < numVertices; j++) {
                for (attributeName in vertexData) {
                    attribute = vertexData[attributeName];

                    switch (attribute.components) {
                        case 1:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j]);
                            break;
                        case 2:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j * 2], attribute.data[j * 2 + 1]);
                            break;
                        case 3:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j * 3], attribute.data[j * 3 + 1], attribute.data[j * 3 + 2]);
                            break;
                        case 4:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j * 4], attribute.data[j * 4 + 1], attribute.data[j * 4 + 2], attribute.data[j * 4 + 3]);
                            break;
                    }
                }
                iterator.next();
            }
            iterator.end();

            vertexBuffers.push(vertexBuffer);
        }

        // Count the number of vertices in the model
        var numIndices = 0;
        for (i = 0; i < modelData.meshes.length; i++) {
            var meshData = modelData.meshes[i];
            if (typeof meshData.indices !== 'undefined') {
                numIndices += meshData.indices.length;
            }
        }

        // Create an index buffer big enough to store all indices in the model
        var indexBuffer = null;
        var indexData = null;
        var indexBase = 0;
        if (numIndices > 0) {
            indexBuffer = new pc.gfx.IndexBuffer(this._device, pc.gfx.INDEXFORMAT_UINT16, numIndices);
            indexData = new Uint16Array(indexBuffer.lock());
        }

        var meshes = [];
        for (i = 0; i < modelData.meshes.length; i++) {
            var meshData = modelData.meshes[i];

            var min = meshData.aabb.min;
            var max = meshData.aabb.max;
            var aabb = new pc.shape.Aabb(
                pc.math.vec3.create((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                pc.math.vec3.create((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
            );

            var indexed = (typeof meshData.indices !== 'undefined');
            var mesh = new pc.scene.Mesh();
            mesh.vertexBuffer = vertexBuffers[meshData.vertices];
            mesh.indexBuffer[0] = indexed ? indexBuffer : null;
            mesh.primitive[0].type = this._jsonToPrimitiveType[meshData.type];
            mesh.primitive[0].base = indexed ? (meshData.base + indexBase) : meshData.base;
            mesh.primitive[0].count = meshData.count;
            mesh.primitive[0].indexed = indexed;
            mesh.skin = (typeof meshData.skin !== 'undefined') ? skins[meshData.skin] : null;
            mesh.aabb = aabb;

            if (indexed) {
                // Create the index buffer
                indexData.set(meshData.indices, indexBase);
                indexBase += meshData.indices.length;
            }
            
            meshes.push(mesh);
        }

        if (numIndices > 0) {
            indexBuffer.unlock();
        }

        var meshInstances = [];
        var skinInstances = [];
        var defaultMaterial = new pc.scene.PhongMaterial();
        for (i = 0; i < modelData.meshInstances.length; i++) {
            var material = (mapping && mapping[i].material) ? this._loadMaterialV2(mapping[i].material) : defaultMaterial;

            var meshInstanceData = modelData.meshInstances[i];

            var mesh = meshes[meshInstanceData.mesh];
            var meshInstance = new pc.scene.MeshInstance(nodes[meshInstanceData.node], mesh, material);

            if (mesh.skin) {
                var skinInstance = new pc.scene.SkinInstance(mesh.skin);
                meshInstance.skinInstance = skinInstance;
                skinInstances.push(skinInstance);
            }

            meshInstances.push(meshInstance);
        }

        var model = new pc.scene.Model();
        model.graph = nodes[0];
        model.meshInstances = meshInstances;
        model.skinInstances = skinInstances;

        // Resolve bone IDs to actual graph nodes
        model.resolveBoneNames();

        model.getGraph().syncHierarchy();

        var meshInstances = model.meshInstances;
        for (i = 0; i < meshInstances.length; i++) {
            meshInstances[i].syncAabb();
        }

        return model;
    };

    ModelResourceHandler.prototype._loadTextureV2 = function(textureId) {
        var asset = this._assets.getAsset(textureId);
        if (!asset) {
            return null;
        }

        var url = asset.getFileUrl();
        if (!url) {
            return null;
        }

        var textureData = asset.data;

        var texture = this._assets.loader.getFromCache(url);
        if (!texture) {
            var texture = new pc.gfx.Texture(this._device, {
                format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8
            });

            texture.name = textureData.name;
            texture.addressU = this._jsonToAddressMode[textureData.addressu];
            texture.addressV = this._jsonToAddressMode[textureData.addressv];
            texture.magFilter = this._jsonToFilterMode[textureData.magfilter];
            texture.minFilter = this._jsonToFilterMode[textureData.minfilter];                
        }

        this._assets.load([asset], [texture], {});    

        return texture;
    };

    // Copy asset data into material
    ModelResourceHandler.prototype._updatePhongMaterial = function (material, data) {
        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                param.data = this._loadTextureV2(param.data);
            }
        }

        material.init(data);
    };

    ModelResourceHandler.prototype._loadMaterialV2 = function(materialId) {
        var material = new pc.scene.PhongMaterial();
        
        var asset = this._assets.getAsset(materialId);
        if (asset) {
            var materialData = asset.data;
            this._updatePhongMaterial(material, asset.data);

            // When running in the tools listen for change events on the asset so we can update the material
            asset.on('change', function (asset, attribute, value) {
                if (attribute === 'data') {
                    this._updatePhongMaterial(material, value);
                }
            }, this);
        }
        
        return material;
    };

    ///////////////////
    // BINARY LOADER //
    ///////////////////

    var attribs = {
        POSITION: 1 << 0,
        NORMAL: 1 << 1,
        COLORS: 1 << 4,
        BONEINDICES: 1 << 5,
        BONEWEIGHTS: 1 << 6,
        UV0: 1 << 7,
        UV1: 1 << 8,
        UV2: 1 << 9,
        UV3: 1 << 10,
        UV4: 1 << 11,
        UV5: 1 << 12,
        UV6: 1 << 13,
        UV7: 1 << 14
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
        var vertexDesc = [];

        if (attributes & attribs.POSITION) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.NORMAL) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_NORMAL, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (pc.gfx.precalculatedTangents) {
            // If we've got positions, normals and uvs, add tangents which will be auto-generated
            if ((attributes & attribs.POSITION) && (attributes & attribs.NORMAL) && (attributes & attribs.UV0)) {
                vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TANGENT, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
            }
        }
        if (attributes & attribs.COLORS) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_COLOR, components: 4, type: pc.gfx.ELEMENTTYPE_UINT8, normalize: true });
        }
        if (attributes & attribs.BONEINDICES) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_BLENDINDICES, components: 4, type: pc.gfx.ELEMENTTYPE_UINT8 });
        }
        if (attributes & attribs.BONEWEIGHTS) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_BLENDWEIGHT, components: 4, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV0) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD0, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV1) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD1, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV2) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD2, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV3) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD3, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV4) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD4, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV5) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD5, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV6) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD6, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }
        if (attributes & attribs.UV7) {
            vertexDesc.push({ semantic: pc.gfx.SEMANTIC_TEXCOORD7, components: 2, type: pc.gfx.ELEMENTTYPE_FLOAT32 });
        }

        return vertexDesc;
    }

    function generateTangentsInPlace(vertexBuffer, indexBuffer) {
        var indices = new Uint16Array(indexBuffer.lock());
        var vertices = vertexBuffer.lock();
        var vertexFormat = vertexBuffer.getFormat();

        var stride = vertexFormat.size;
        var positions, normals, tangents, uvs;
        for (var el = 0; el < vertexFormat.elements.length; el++) {
            var element = vertexFormat.elements[el];
            if (element.name === pc.gfx.SEMANTIC_POSITION) {
                positions = new Float32Array(vertices, element.offset);
            } else if (element.name === pc.gfx.SEMANTIC_NORMAL) {
                normals = new Float32Array(vertices, element.offset);
            } else if (element.name === pc.gfx.SEMANTIC_TANGENT) {
                tangents = new Float32Array(vertices, element.offset);
            } else if (element.name === pc.gfx.SEMANTIC_TEXCOORD0) {
                uvs = new Float32Array(vertices, element.offset);
            }
        }

        if (!(positions && normals && uvs)) return;

        var triangleCount = indices.length / 3;
        var vertexCount   = vertices.byteLength / stride;
        var i1, i2, i3;
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

        t1 = pc.math.vec3.create(0, 0, 0);
        t2 = pc.math.vec3.create(0, 0, 0);
        var n    = pc.math.vec3.create(0, 0, 0);
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

    function MemoryStream(arrayBuffer, loader, device, textureCache, options) {
        this.memory = arrayBuffer;
        this.dataView = (typeof DataView !== 'undefined') ? new DataView(arrayBuffer) : null;
        this.filePointer = 0;
        this.options = options;
        this.loader = loader;
        this.device = device;
        this.textureCache = textureCache;
    }

    MemoryStream.prototype = {

        // Basic type reading
        readF32: function (count) {
            count = count || 1;
            var data;
            if (count === 1) {
                if (this.dataView) {
                    data = this.dataView.getFloat32(this.filePointer, true);
                } else {
                    data = (new Float32Array(this.memory, this.filePointer, 1))[0];
                }
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
                if (this.dataView) {
                    data = this.dataView.getUint8(this.filePointer, true);
                } else {
                    data = (new Uint8Array(this.memory, this.filePointer, 1))[0];
                }
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
                if (this.dataView) {
                    data = this.dataView.getUint16(this.filePointer, true);
                } else {
                    data = (new Uint16Array(this.memory, this.filePointer, 1))[0];
                }
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
                if (this.dataView) {
                    data = this.dataView.getUint32(this.filePointer, true);
                } else {
                    data = (new Uint32Array(this.memory, this.filePointer, 1))[0];
                }
            } else {
                data = new Uint32Array(this.memory, this.filePointer, count);
            }
            this.filePointer += 4 * count;
            return data;
        },

        readString: function (length) {
            var str = "";
            for (var i = 0; i < length; i++) {
                var charCode = this.readU8();
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
            var addressU  = this.readU8();
            var addressV  = this.readU8();
            var minFilter = this.readU8();
            var magFilter = this.readU8();

            var url = this.options.directory + "/" + filename;
            
            var texture = null;
            if (this.textureCache) {
                texture = this.textureCache.getTexture(url);
            }
            
            if (!texture) {
                var ext = pc.path.getExtension(url);
                var format = (ext === '.png') ? pc.gfx.PIXELFORMAT_R8_G8_B8_A8 : pc.gfx.PIXELFORMAT_R8_G8_B8;
                texture = new pc.gfx.Texture(this.device, {
                    format: format
                });
                texture.name = name;
                texture.addressU = addressU;
                texture.addressV = addressV;
                texture.minFilter = minFilter;
                texture.magFilter = magFilter;

                // Add to textureCache cache  
                if (this.textureCache) {
                    this.textureCache.addTexture(url, texture);
                }

                // Make a request for the Image resource
                var promise = this.loader.request(new pc.resources.ImageRequest(url), this.options);
                promise.then(function (resources) {
                    texture.setSource(resources[0]);
                });
            }

            return texture;
        },

        readMaterialParamChunk: function () {
            var i;
            var header = this.readChunkHeader();
            var name   = this.readStringChunk();
            var type   = this.readU32();
            var data;
            switch (type) {
                case pc.gfx.ShaderInputType.BOOL:
                    data = (this.readU32() !== 0);
                    break;
                case pc.gfx.ShaderInputType.FLOAT:
                    data = this.readF32();
                    break;
                case pc.gfx.ShaderInputType.INT:
                    data = this.readU32();
                    break;
                case pc.gfx.ShaderInputType.VEC2:
                    data = pc.math.vec2.create();
                    for (i = 0; i < 2; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.VEC3:
                    data = pc.math.vec3.create();
                    for (i = 0; i < 3; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.VEC4:
                    data = pc.math.vec4.create();
                    for (i = 0; i < 4; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC2:
                    data = pc.math.vec2.create();
                    for (i = 0; i < 2; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC3:
                    data = pc.math.vec3.create();
                    for (i = 0; i < 3; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC4:
                    data = pc.math.vec4.create();
                    for (i = 0; i < 4; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC2:
                    data = [];
                    for (i = 0; i < 2; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC3:
                    data = [];
                    for (i = 0; i < 3; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC4:
                    data = [];
                    for (i = 0; i < 4; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT2:
                    data = new Float32Array(4); // PlayCanvas doesn't currently have a 2D matrix type
                    for (i = 0; i < 4; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT3:
                    data = pc.math.mat3.create();
                    for (i = 0; i < 9; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT4:
                    data = pc.math.mat4.create();
                    for (i = 0; i < 16; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.TEXTURE2D:
                case pc.gfx.ShaderInputType.TEXTURECUBE:
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

            var material = new pc.scene.PhongMaterial();
            material.name = name;

            // Read each shader parameter
            for (var i = 0; i < numParams; i++) {
                var param = this.readMaterialParamChunk();

                switch (param.name) {
                    case 'material_ambient': 
                        material.ambient = param.data;
                        break;
                    case 'material_diffuse': 
                        material.diffuse = param.data;
                        break;
                    case 'texture_diffuseMap': 
                        material.diffuseMap = param.data;
                        break;
                    case 'texture_diffuseMapTransform': 
                        material.diffuseMapTransform = param.data;
                        break;
                    case 'material_specular': 
                        material.specular = param.data;
                        break;
                    case 'texture_specularMap': 
                        material.specularMap = param.data;
                        break;
                    case 'texture_specularMapTransform': 
                        material.specularMapTransform = param.data;
                        break;
                    case 'texture_specularFactorMap':
                        material.specularFactorMap = param.data;
                        break;
                    case 'texture_specularFactorMapTransform': 
                        material.specularFactorMapTransform = param.data;
                        break;
                    case 'material_shininess':
                        material.shininess = param.data;
                        break;
                    case 'texture_glossMap':
                        material.glossMap = param.data;
                        break;
                    case 'texture_glossMapTransform': 
                        material.glossMapTransform = param.data;
                        break;
                    case 'material_emissive':
                        material.emissive = param.data;
                        break;
                    case 'texture_emissiveMap': 
                        material.emissiveMap = param.data;
                        break;
                    case 'texture_emissiveMapTransform': 
                        material.emissiveMapTransform = param.data;
                        break;
                    case 'material_opacity':
                        material.opacity = param.data;
                        if (material.opacity < 1) {
                            material.blendType = pc.scene.BLEND_NORMAL;
                        }
                        break;
                    case 'texture_opacityMap': 
                        material.opacityMap = param.data;
                        material.blendType = pc.scene.BLEND_NORMAL;
                        break;
                    case 'texture_opacityMapTransform': 
                        material.opacityMapTransform = param.data;
                        break;
                    case 'texture_sphereMap': 
                        material.reflectionMap = param.data;
                        break;
                    case 'texture_cubeMap': 
                        material.reflectionMap = param.data;
                        break;
                    case 'material_reflectionFactor':
                        material.reflectivity = param.data;
                        break;
                    case 'texture_normalMap': 
                        material.normalMap = param.data;
                        break;
                    case 'texture_normalMapTransform': 
                        material.normalMapTransform = param.data;
                        break;
                    case 'texture_heightMap': 
                        material.heightMap = param.data;
                        break;
                    case 'texture_heightMapTransform': 
                        material.heightMapTransform = param.data;
                        break;
                    case 'material_bumpMapFactor': 
                        material.bumpMapFactor = param.data;
                        break;
                    case 'texture_lightMap': 
                        material.lightMap = param.data;
                        break;
                }
            }

            material.update();

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
            var vertexDesc = translateFormat(format);
            var vertexFormat = new pc.gfx.VertexFormat(this.device, vertexDesc);
            var vertexBuffer = new pc.gfx.VertexBuffer(this.device, vertexFormat, count);
            var vbuff = vertexBuffer.lock();
            var dst = new Uint8Array(vbuff);
            var src = this.readU8(count * stride);

            if (pc.gfx.precalculatedTangents) {
                copyToBuffer(dst, src, format, stride);
            } else {
                dst.set(src);
            }
            vertexBuffer.unlock();
            
            return vertexBuffer;
        },

        readIndexBufferChunk: function () {
            var header = this.readChunkHeader();
            var type = this.readU32();
            var numIndices = this.readU32();

            var indexBuffer = new pc.gfx.IndexBuffer(this.device, type, numIndices);
            var ibuff = indexBuffer.lock();
            var src, dst;
            if (type === pc.gfx.INDEXFORMAT_UINT8) {
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
            var i, j;
            var header = this.readChunkHeader();

            var aabb = this.readAabbChunk();
            var vertexBuffer = this.readVertexBufferChunk();
            var indexBuffer = this.readIndexBufferChunk();
            var subMeshes = this.readSubMeshesChunk();
            var numBones  = this.readU32();
            var inverseBindPose = [];
            var boneNames = [];
            if (numBones > 0) {
                for (i = 0; i < numBones; i++) {
                    var ibm = pc.math.mat4.create();
                    for (j = 0; j < 16; j++) {
                        ibm[j] = this.readF32();
                    }
                    inverseBindPose.push(ibm);
                }
                for (i = 0; i < numBones; i++) {
                    var boneName = this.readStringChunk();
                    boneNames.push(boneName);
                }
            }

            if (pc.gfx.precalculatedTangents) {
                generateTangentsInPlace(vertexBuffer, indexBuffer);
            }

            var model = this.model;
            var skin, skinInstance;
            if (inverseBindPose.length > 0) {
                skin = new pc.scene.Skin(inverseBindPose, boneNames);
                model.skins.push(skin);
                model.skinInstances.push(new pc.scene.SkinInstance(skin));
            }

            var meshes = [];

            // Create and read each submesh
            for (i = 0; i < subMeshes.length; i++) {
                var subMesh = subMeshes[i];

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = subMesh.primitive.type;
                mesh.primitive[0].base = subMesh.primitive.base;
                mesh.primitive[0].count = subMesh.primitive.count;
                mesh.primitive[0].indexed = true;
                mesh.skin = skin ? skin : null;
                mesh.aabb = aabb;

                mesh._material = subMesh.material;

                meshes.push(mesh);
            }

            if (inverseBindPose.length > 0) {
                var maxBones = this.device.getBoneLimit();
                if (inverseBindPose.length > maxBones) {
                    meshes = pc.scene.partitionSkin(this.device, maxBones, [vertexBuffer], indexBuffer, meshes, skin);
                }

                for (i = 0; i < meshes.length; i++) {
                    skin = meshes[i].skin;
                    var skinIndex = model.skins.indexOf(skin);
                    if (skinIndex === -1) {
                        model.skins.push(skin);
                        skinInstance = new pc.scene.SkinInstance(skin);
                        model.skinInstances.push(skinInstance);
                    }
                }
            }

            return meshes;
        },

        readNodeChunk: function () {
            var header = this.readChunkHeader();

            // Read the GraphNode properties
            var nodeType  = this.readU32();
            var name      = this.readStringChunk();
            var px = this.readF32();
            var py = this.readF32();
            var pz = this.readF32();
            var rx = this.readF32();
            var ry = this.readF32();
            var rz = this.readF32();
            var sx = this.readF32();
            var sy = this.readF32();
            var sz = this.readF32();
            var r, g, b, a;

            var node;
            switch (nodeType) {
                case 0: // GraphNode
                    node = new pc.scene.GraphNode();
                    node.setName(name);
                    node.setLocalPosition(px, py, pz);
                    node.setLocalEulerAngles(rx, ry, rz);
                    node.setLocalScale(sx, sy, sz);
                    break;
                case 1: // Camera
                    node = new pc.scene.CameraNode();
                    node.setName(name);
                    node.setLocalPosition(px, py, pz);
                    node.setLocalEulerAngles(rx, ry, rz);
                    node.setLocalScale(sx, sy, sz);

                    var projection = this.readU32();
                    var nearClip = this.readF32();
                    var farClip = this.readF32();
                    var fov = this.readF32();
                    r = this.readF32();
                    g = this.readF32();
                    b = this.readF32();
                    a = this.readF32();

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
                    node.setLocalPosition(px, py, pz);
                    node.setLocalEulerAngles(rx, ry, rz);
                    node.setLocalScale(sx, sy, sz);

                    var type = this.readU16();
                    var enabled = this.readU8();
                    var castShadows = this.readU8();
                    r = this.readF32();
                    g = this.readF32();
                    b = this.readF32();
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
                    node = new pc.scene.GraphNode();
                    node.setName(name);
                    node.setLocalPosition(px, py, pz);
                    node.setLocalEulerAngles(rx, ry, rz);
                    node.setLocalScale(sx, sy, sz);

                    // Mesh specific properties
                    var model = this.model;
                    var geomIndex = this.readU32();
                    var geometry = model.geometries[geomIndex];

                    for (var i = 0; i < geometry.length; i++) {
                        var meshInstance = new pc.scene.MeshInstance(node, geometry[i], geometry[i]._material);
                        if (geometry[i].skin) {
                            var skinIndex = model.skins.indexOf(geometry[i].skin);
                            meshInstance.skinInstance = model.skinInstances[skinIndex];
                        }
                        model.meshInstances.push(meshInstance);
                    }

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
            this.model.geometries = [];
            for (i = 0; i < numGeometries; i++) {
                this.model.geometries.push(this.readGeometryChunk(this.model));
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
            this.model.graph = nodes[0];

            // Resolve bone IDs to actual graph nodes
            this.model.resolveBoneNames();

            this.model.getGraph().syncHierarchy();

            var meshInstances = this.model.meshInstances;
            for (i = 0; i < meshInstances.length; i++) {
                meshInstances[i].syncAabb();
            }

            return this.model;
        }
    };

    ModelResourceHandler.prototype._loadModelBin = function (data, options) {
        var stream = new MemoryStream(data, this._loader, this._device, this._textureCache, options);
        return stream.readModelChunk();
    };
    
	var ModelRequest = function ModelRequest(identifier) {		
	};
	ModelRequest = pc.inherits(ModelRequest, pc.resources.ResourceRequest);
    ModelRequest.prototype.type = "model";
    ModelRequest.prototype.Type = pc.scene.Model;
    
	return {
		ModelResourceHandler: ModelResourceHandler,
		ModelRequest: ModelRequest
	};
}());
