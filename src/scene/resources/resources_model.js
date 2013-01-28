pc.extend(pc.resources, function () {
	/**
	 * @name pc.resources.ModelResourceHandler
	 * @description Resource Handler for creating pc.scene.Model resources
	 */
	var ModelResourceHandler = function (textureCache) {
        // optional textureCache for new texture cache
        this._textureCache = textureCache;

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
            "repeat": pc.gfx.ADDRESS_REPEAT,
            "clamp":  pc.gfx.ADDRESS_CLAMP_TO_EDGE,
            "mirror": pc.gfx.ADDRESS_MIRRORED_REPEAT
        }
        
        this._jsonToFilterMode = {
            "nearest":             pc.gfx.FILTER_NEAREST,
            "linear":              pc.gfx.FILTER_LINEAR,
            "nearest_mip_nearest": pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST,
            "linear_mip_nearest":  pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST,
            "nearest_mip_linear":  pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR,
            "linear_mip_linear":   pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
        }
        
        this._jsonToProjectionType = {
            "perspective"  : pc.scene.Projection.PERSPECTIVE,
            "orthographic" : pc.scene.Projection.ORTHOGRAPHIC
        }
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
     * @param {String} [options.identifier] The identifier used to load the resource, this is used to store the opened resource in the loader cache 
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

    ModelResourceHandler.prototype.clone = function (model) {
        return model.clone();
    }

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
     * @param options.priority The priority to load the textures with
     * @param [options.batch] An existing request batch handle to add the texture request to 
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
            texture = new pc.gfx.Texture({
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
                case 'material_shininess':
                    material.shininess = param.data;
                    break;
                case 'texture_glossMap': 
                    material.glossMap = model.getTextures()[param.data]; 
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
                    break;
                case 'texture_opacityMap': 
                    material.opacityMap = model.getTextures()[param.data]; 
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
                case 'texture_parallaxMap': 
                    material.parallaxMap = model.getTextures()[param.data]; 
                    break;
                case 'texture_parallaxMapTransform': 
                    material.parallaxMapTransform = pc.math[param.type].clone(param.data); 
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
    
        // Create the index buffer
        var indexBuffer = new pc.gfx.IndexBuffer(pc.gfx.IndexFormat.UINT16, geomData.indices.data.length);
        var dst = new Uint16Array(indexBuffer.lock());
        dst.set(geomData.indices.data);
        indexBuffer.unlock();

        // Skinning data
        var skin, skinInstance;
        if (geomData.inverse_bind_pose !== undefined) {
            var inverseBindPose = [];
            for (var i = 0; i < geomData.inverse_bind_pose.length; i++) {
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
        for (var i = 0; i < geomData.submeshes.length; i++) {
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
            var device = pc.gfx.Device.getCurrent();
            var maxBones = device.getBoneLimit();
            if (geomData.inverse_bind_pose.length > maxBones) {
                meshes = pc.scene.partitionSkin(maxBones, [vertexBuffer], indexBuffer, meshes, skin);
            }

            for (var i = 0; i < meshes.length; i++) {
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

            // Need to update JSON file format to have bone names instead of graph IDs
            for (var i = 0; i < model.skins.length; i++) {
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

    function translateFormat(attributes) {
        var vertexFormat = new pc.gfx.VertexFormat();

        vertexFormat.begin();
        if (attributes & attribs.POSITION) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_position", 3, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.NORMAL) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_normal", 3, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.COLORS) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_color", 4, pc.gfx.VertexElementType.UINT8), true);
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
        if (attributes & attribs.UV2) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord2", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV3) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord3", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV4) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord4", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV5) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord5", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV6) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord6", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        if (attributes & attribs.UV7) {
            vertexFormat.addElement(new pc.gfx.VertexElement("vertex_texCoord7", 2, pc.gfx.VertexElementType.FLOAT32));
        }
        vertexFormat.end();

        return vertexFormat;
    }

    function MemoryStream(arrayBuffer, loader, textureCache, options) {
        this.memory = arrayBuffer;
        this.dataView = (typeof DataView !== 'undefined') ? new DataView(arrayBuffer) : null;
        this.filePointer = 0;
        this.options = options;
        this.loader = loader;
        this.textureCache = textureCache;
    };

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
                texture = new pc.gfx.Texture({
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
            }

            return texture;
        },

        readMaterialParamChunk: function () {
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
                    for (var i = 0; i < 2; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.VEC3:
                    data = pc.math.vec3.create();
                    for (var i = 0; i < 3; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.VEC4:
                    data = pc.math.vec4.create();
                    for (var i = 0; i < 4; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC2:
                    data = pc.math.vec2.create();
                    for (var i = 0; i < 2; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC3:
                    data = pc.math.vec3.create();
                    for (var i = 0; i < 3; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.IVEC4:
                    data = pc.math.vec4.create();
                    for (var i = 0; i < 4; i++) {
                        data[i] = this.readU32();
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC2:
                    data = [];
                    for (var i = 0; i < 2; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC3:
                    data = [];
                    for (var i = 0; i < 3; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.BVEC4:
                    data = [];
                    for (var i = 0; i < 4; i++) {
                        data.push(this.readU32() !== 0);
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT2:
                    data = new Float32Array(4); // PlayCanvas doesn't currently have a 2D matrix type
                    for (var i = 0; i < 4; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT3:
                    data = pc.math.mat3.create();
                    for (var i = 0; i < 9; i++) {
                        data[i] = this.readF32();
                    }
                    break;
                case pc.gfx.ShaderInputType.MAT4:
                    data = pc.math.mat4.create();
                    for (var i = 0; i < 16; i++) {
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
                    case 'material_shininess':
                        material.shininess = param.data;
                        break;
                    case 'texture_glossMap': 
                        material.glossMap = param.data;
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
                        break;
                    case 'texture_opacityMap': 
                        material.opacityMap = param.data;
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
                    case 'texture_parallaxMap': 
                        material.parallaxMap = param.data;
                        break;
                    case 'texture_parallaxMapTransform': 
                        material.parallaxMapTransform = param.data;
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
            var vertexFormat = translateFormat(format);

            var vertexBuffer = new pc.gfx.VertexBuffer(vertexFormat, count);
            var vbuff = vertexBuffer.lock();
            var dst = new Uint8Array(vbuff);
            var src = this.readU8(count * stride);
            dst.set(src);
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

            var aabb = this.readAabbChunk();
            var vertexBuffer = this.readVertexBufferChunk();
            var indexBuffer = this.readIndexBufferChunk();
            var subMeshes = this.readSubMeshesChunk();
            var numBones  = this.readU32();
            var inverseBindPose = [];
            var boneNames = [];
            if (numBones > 0) {
                for (var i = 0; i < numBones; i++) {
                    var ibm = pc.math.mat4.create();
                    for (var j = 0; j < 16; j++) {
                        ibm[j] = this.readF32();
                    }
                    inverseBindPose.push(ibm);
                }
                for (var i = 0; i < numBones; i++) {
                    var boneName = this.readStringChunk();
                    boneNames.push(boneName);
                }
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
            for (var i = 0; i < subMeshes.length; i++) {
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

            var model = this.model;
            if (inverseBindPose.length > 0) {
                var device = pc.gfx.Device.getCurrent();
                var maxBones = device.getBoneLimit();
                if (inverseBindPose.length > maxBones) {
                    meshes = pc.scene.partitionSkin(maxBones, [vertexBuffer], indexBuffer, meshes, skin);
                }

                for (var i = 0; i < meshes.length; i++) {
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
                    node.setLocalPosition(px, py, pz);
                    node.setLocalEulerAngles(rx, ry, rz);
                    node.setLocalScale(sx, sy, sz);

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
        var stream = new MemoryStream(data, this._loader, this._textureCache, options);
        return stream.readModelChunk();
    };
    
	var ModelRequest = function ModelRequest(identifier) {		
	};
	ModelRequest = pc.inherits(ModelRequest, pc.resources.ResourceRequest);
    ModelRequest.prototype.type = "model";

	return {
		ModelResourceHandler: ModelResourceHandler,
		ModelRequest: ModelRequest
	}
}());
