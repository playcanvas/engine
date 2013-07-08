pc.extend(pc.resources, function () {

    var jsonToPrimitiveType = {
        "points":        pc.gfx.PRIMITIVE_POINTS,
        "lines":         pc.gfx.PRIMITIVE_LINES,
        "linestrip":     pc.gfx.PRIMITIVE_LINESTRIP,
        "triangles":     pc.gfx.PRIMITIVE_TRIANGLES,
        "trianglestrip": pc.gfx.PRIMITIVE_TRISTRIP
    };

    var jsonToVertexElementType = {
        "int8":    pc.gfx.ELEMENTTYPE_INT8,
        "uint8":   pc.gfx.ELEMENTTYPE_UINT8,
        "int16":   pc.gfx.ELEMENTTYPE_INT16,
        "uint16":  pc.gfx.ELEMENTTYPE_UINT16,
        "int32":   pc.gfx.ELEMENTTYPE_INT32,
        "uint32":  pc.gfx.ELEMENTTYPE_UINT32,
        "float32": pc.gfx.ELEMENTTYPE_FLOAT32
    };

    var jsonToLightType = {
        "directional": pc.scene.LightType.DIRECTIONAL,
        "point":       pc.scene.LightType.POINT,
        "spot":        pc.scene.LightType.SPOT
    };
    
    var jsonToAddressMode = {
        "repeat": pc.gfx.ADDRESS_REPEAT,
        "clamp":  pc.gfx.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.gfx.ADDRESS_MIRRORED_REPEAT
    };

    var jsonToFilterMode = {
        "nearest":             pc.gfx.FILTER_NEAREST,
        "linear":              pc.gfx.FILTER_LINEAR,
        "nearest_mip_nearest": pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest":  pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear":  pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear":   pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
    };

    var jsonToProjectionType = {
        "perspective":  pc.scene.Projection.PERSPECTIVE,
        "orthographic": pc.scene.Projection.ORTHOGRAPHIC
    };

    /**
     * @name pc.resources.ModelResourceHandler
     * @class Resource Handler for creating pc.scene.Model resources
     */
    var ModelResourceHandler = function (device, assetRegistry) {
        this._device = device;
        this._assets = assetRegistry;
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

        var model = null;
        if (data.model.version <= 1) {
            logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", request.canonical));
        } else {
            model = this._loadModelJson(data, request.data, options);
        }

        return model;
    };

    ModelResourceHandler.prototype.clone = function (model) {
        return model.clone();
    };

    /**
    * @function
    * @name pc.resources.ModelResourceHandler#_loadModelJson
    * @description Load a pc.scene.Model from data in the PlayCanvas JSON format
    * @param {Object} json The data
    * @param {Object} mapping An array of mapping data, for each mesh there should be a entry with a 'material' field mapping meshInstance to material asset
    */
    ModelResourceHandler.prototype._loadModelJson = function (data, mapping, options) {
        var modelData = data.model;
        var i, j;

        ////////////////////
        // NODE HIERARCHY //
        ////////////////////
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

        ///////////
        // SKINS //
        ///////////
        if (modelData.skins.length > 0) {
//            pc.scene.partitionSkin(modelData, mapping, 40);
        }

        var skins = [];
        var skinInstances = [];
        for (i = 0; i < modelData.skins.length; i++) {
            var skinData = modelData.skins[i];

            var inverseBindMatrices = [];
            for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                inverseBindMatrices[j] = pc.math.mat4.clone(skinData.inverseBindMatrices[j]);
            }

            var skin = new pc.scene.Skin(inverseBindMatrices, skinData.boneNames);
            skins.push(skin);

            var skinInstance = new pc.scene.SkinInstance(skin);
            // Resolve bone IDs to actual graph nodes
            var bones = [];
            for (j = 0; j < skin.boneNames.length; j++) {
                var boneName = skin.boneNames[j];
                var bone = nodes[0].findByName(boneName);
                bones.push(bone);
            }
            skinInstance.bones = bones;
            skinInstances.push(skinInstance);
        }

        ////////////////////
        // VERTEX BUFFERS //
        ////////////////////
        var vertexBuffers = [];
        var attribute, attributeName;
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
                    type: jsonToVertexElementType[attribute.type],
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

        //////////////////
        // INDEX BUFFER //
        //////////////////

        // Count the number of indices in the model
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

        ////////////
        // MESHES //
        ////////////
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
            mesh.primitive[0].type = jsonToPrimitiveType[meshData.type];
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

        ////////////////////
        // MESH INSTANCES //
        ////////////////////
        var meshInstances = [];
        var defaultMaterial = new pc.scene.PhongMaterial();
        for (i = 0; i < modelData.meshInstances.length; i++) {
            var meshInstanceData = modelData.meshInstances[i];

            var node = nodes[meshInstanceData.node];
            var mesh = meshes[meshInstanceData.mesh];
            var material = (mapping && mapping[i].material) ? this._loadMaterialV2(mapping[i].material) : defaultMaterial;

            var meshInstance = new pc.scene.MeshInstance(node, mesh, material);

            if (mesh.skin) {
                var skinIndex = skins.indexOf(mesh.skin);
                if (skinIndex === -1) {
                    throw new Error('Mesh\'s skin does not appear in skin array.');
                }
                meshInstance.skinInstance = skinInstances[skinIndex];
            }

            meshInstances.push(meshInstance);
        }

        var model = new pc.scene.Model();
        model.graph = nodes[0];
        model.meshInstances = meshInstances;
        model.skinInstances = skinInstances;
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
            texture.addressU = jsonToAddressMode[textureData.addressu];
            texture.addressV = jsonToAddressMode[textureData.addressv];
            texture.magFilter = jsonToFilterMode[textureData.magfilter];
            texture.minFilter = jsonToFilterMode[textureData.minfilter];                
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
