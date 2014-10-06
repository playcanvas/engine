pc.extend(pc.resources, function () {

    var jsonToPrimitiveType = {
        "points":        pc.gfx.PRIMITIVE_POINTS,
        "lines":         pc.gfx.PRIMITIVE_LINES,
        "lineloop":      pc.gfx.PRIMITIVE_LINELOOP,
        "linestrip":     pc.gfx.PRIMITIVE_LINESTRIP,
        "triangles":     pc.gfx.PRIMITIVE_TRIANGLES,
        "trianglestrip": pc.gfx.PRIMITIVE_TRISTRIP,
        "trianglefan":   pc.gfx.PRIMITIVE_TRIFAN
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
        "directional": pc.scene.LIGHTTYPE_DIRECTIONAL,
        "point":       pc.scene.LIGHTTYPE_POINT,
        "spot":        pc.scene.LIGHTTYPE_SPOT
    };

    var jsonToProjectionType = {
        "perspective":  pc.scene.Projection.PERSPECTIVE,
        "orthographic": pc.scene.Projection.ORTHOGRAPHIC
    };

    /**
     * @name pc.resources.ModelResourceHandler
     * @class Resource Handler for creating pc.scene.Model resources
     * @description {@link pc.resources.ResourceHandler} use to load 3D model resources
     * @param {pc.gfx.Device} device The graphics device that will be rendering
     * @param {pc.asset.AssetRegistry} assetRegistry The AssetRegistry that is being used by the current application
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
     */
    ModelResourceHandler.prototype.load = function (request, options) {
        var self = this;

        if (request.data) {
            var asset;
            var materials = [];
            var mapping = request.data;
            for (var i = 0; i < mapping.length; i++) {
                if (mapping[i].material) {
                    asset = this._assets.getAssetByResourceId(mapping[i].material);
                    if (asset) {
                        materials.push(asset);
                    }
                }
            }
        }

        var promise = new pc.promise.Promise(function (resolve, reject) {
            var url = request.canonical;
            options = options || {};
            options.directory = pc.path.getDirectory(url);

            pc.net.http.get(url, function (response) {
                // load all required materials before resolving
                if (materials.length) {
                    self._assets.load(materials).then(function () {
                        resolve(response);
                    });
                } else {
                    resolve(response);
                }
            }, {
                cache: options.cache,
                error: function (status, xhr, e) {
                    reject(pc.string.format("Error loading model: {0} [{1}]", url, status));
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
	 * @param {String} [options.directory] The directory to load textures from
	 */
    ModelResourceHandler.prototype.open = function (data, request, options) {
        options = options || {};
        options.directory = options.directory || "";
        options.parent = request; // the model request is used as the parent for any texture requests

        var model = null;
        if (data.model.version <= 1) {
            logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", request.canonical));
        } else if (data.model.version >= 2) {
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
            node.setLocalPosition(nodeData.position[0], nodeData.position[1], nodeData.position[2]);
            node.setLocalEulerAngles(nodeData.rotation[0], nodeData.rotation[1], nodeData.rotation[2]);
            node.setLocalScale(nodeData.scale[0], nodeData.scale[1], nodeData.scale[2]);

            nodes.push(node);
        }

        for (i = 1; i < modelData.parents.length; i++) {
            nodes[modelData.parents[i]].addChild(nodes[i]);
        }

        ///////////
        // SKINS //
        ///////////
        if (!this._device.supportsBoneTextures && modelData.skins.length > 0) {
            var boneLimit = this._device.getBoneLimit();
            pc.scene.partitionSkin(modelData, mapping, boneLimit);
        }

        var skins = [];
        var skinInstances = [];
        for (i = 0; i < modelData.skins.length; i++) {
            var skinData = modelData.skins[i];

            var inverseBindMatrices = [];
            for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                var ibm = skinData.inverseBindMatrices[j];
                inverseBindMatrices[j] = new pc.Mat4(ibm[0], ibm[1], ibm[2], ibm[3],
                                                     ibm[4], ibm[5], ibm[6], ibm[7],
                                                     ibm[8], ibm[9], ibm[10], ibm[11],
                                                     ibm[12], ibm[13], ibm[14], ibm[15]);
            }

            var skin = new pc.scene.Skin(this._device, inverseBindMatrices, skinData.boneNames);
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

                var attribType = attribute.type;
                if (!this._device.supportsUnsignedByte) {
                    if (attribType === "uint8") {
                        attribType = "float32";
                    }
                    if (attribType === "int8") {
                        attribType = "float32";
                    }
                }

                formatDesc.push({
                    semantic: attributeMap[attributeName],
                    components: attribute.components,
                    type: jsonToVertexElementType[attribType],
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
                new pc.Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                new pc.Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
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
            var material = this._getMaterial(i, mapping, options);
            if (!material) {
                material = defaultMaterial;
            }
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

        return model;
    };

    /**
    * Load the material using either the material resource id or the path provided in the mapping
    */
    ModelResourceHandler.prototype._getMaterial = function (meshInstanceIndex, mapping, options) {
        var material;

        if (mapping && mapping.length > meshInstanceIndex) {
            if (mapping[meshInstanceIndex].material) { // resource id mapping
                var asset = this._assets.getAssetByResourceId(mapping[meshInstanceIndex].material);
                if (!asset) {
                    console.error("Reference to material not in asset list. Try reloading.")
                    return null;
                } else if (!asset.resource) {
                    console.error(pc.string.format("Material asset '{0}' is not loaded.", asset.name));
                    return null;
                }
                material = asset.resource;
            } else if (mapping[meshInstanceIndex].path) { // path mapping
                // get directory of model
                var path = pc.path.split(options.parent.canonical)[0];
                path = pc.path.join(path, mapping[meshInstanceIndex].path);

                // Get material asset
                var asset = this._assets.getAssetByUrl(path);
                if (asset) {
                    material = asset.resource;
                }
            }
        }

        return material;
    }

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
