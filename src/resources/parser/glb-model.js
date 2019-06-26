Object.assign(pc, function () {
    'use strict';

    // Take PlayCanvas JSON model data and create pc.Model
    var GLBModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GLBModelParser.prototype, {
        parse: function (glb, onLoaded, onFailed) {
            var dataView = new DataView(glb);

            // Read header
            var magic = dataView.getUint32(0, true);
            if (magic !== 0x46546C67) {
                console.error("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
                return null;
            }
            var version = dataView.getUint32(4, true);
            if (version !== 2) {
                console.error("Invalid version number found in glb header. Expected 2, found " + version);
                return null;
            }
            var length = dataView.getUint32(8, true);

            // Read JSON chunk
            var chunkLength = dataView.getUint32(12, true);
            var chunkType = dataView.getUint32(16, true);
            if (chunkType !== 0x4E4F534A) {
                console.error("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + chunkType.toString(16));
                return null;
            }
            var jsonData = new Uint8Array(glb, 20, chunkLength);
            var gltf = JSON.parse(decodeBinaryUtf8(jsonData));

            // Read the binary buffers
            var buffers = [];
            var byteOffset = 20 + chunkLength;
            while (byteOffset < length) {
                chunkLength = dataView.getUint32(byteOffset, true);
                chunkType = dataView.getUint32(byteOffset + 4, true);
                if (chunkType !== 0x004E4942) {
                    console.error("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + chunkType.toString(16));
                    return null;
                }

                var buffer = glb.slice(byteOffset + 8, byteOffset + 8 + chunkLength);
                buffers.push(buffer);

                byteOffset += chunkLength + 8;
            }

            var options = { buffers: buffers };
            this.loadGltf(gltf, options, onLoaded, onFailed);
        },

        loadGltf: function (gltf, options, onLoaded, onFailed) {
            var buffers = (options && options.hasOwnProperty('buffers')) ? options.buffers : undefined;
            var basePath = (options && options.hasOwnProperty('basePath')) ? options.basePath : undefined;
            var processUri = (options && options.hasOwnProperty('processUri')) ? options.processUri : undefined;
            var processAnimationExtras = (options && options.hasOwnProperty('processAnimationExtras')) ? options.processAnimationExtras : undefined;
            var processMaterialExtras = (options && options.hasOwnProperty('processMaterialExtras')) ? options.processMaterialExtras : undefined;
            var processGlobalExtras = (options && options.hasOwnProperty('processGlobalExtras')) ? options.processGlobalExtras : undefined;

            var context = new LoaderContext(this._device, onLoaded, onFailed);
            Object.assign(context, {
                basePath: basePath,
                buffers: buffers,
                defaultMaterial: this._defaultMaterial,
                gltf: gltf,
                processUri: processUri,
                processAnimationExtras: processAnimationExtras,
                processMaterialExtras: processMaterialExtras,
                processGlobalExtras: processGlobalExtras
            });

            if (gltf.hasOwnProperty('extensionsUsed')) {
                if (gltf.extensionsUsed.indexOf('KHR_draco_mesh_compression') !== -1) {
                    context.decoderModule = options.decoderModule;
                }
            }

            context.loadBuffers();
        }
    });

    function LoaderContext(device, onLoaded, onFailed) {
        this._device = device;
        this._onLoaded = onLoaded;
        this._onFailed = onFailed;
    }

    LoaderContext.prototype.loadBuffers = function () {
        new pc.GLBHelpers.BuffersLoader(this, this.parseAll.bind(this)).load();
    };

    LoaderContext.prototype.parseAll = function () {
        this.parse('textures', pc.GLBHelpers.translateTexture);

        var imgLoader = pc.GLBHelpers.ImageLoader(this, function () {
            this.parse('materials', pc.GLBHelpers.translateMaterial);
            this.parse('meshes', pc.GLBHelpers.translateMesh);
            var nodeLoader = pc.GLBHelpers.NodeLoader();
            this.parse('nodes', nodeLoader.translate.bind(nodeLoader));
            this.parse('skins', pc.GLBHelpers.translateSkin);
            // this.parse('animations', pc.GLBHelpers.translateAnimation);

            this.finalize();
        }.bind(this));
        this.parse('images', imgLoader.translate.bind(imgLoader));
    };

    LoaderContext.prototype.finalize = function () {
        if (this.gltf.hasOwnProperty('extras') && this.processGlobalExtras)
            this.processGlobalExtras(gltf.extras);

        this.buildHierarchy();
        this.createModel();

        this._onLoaded([context.model].concat(context.materials).concat(context.textures));//.concat(context.animations));

        if (gltf.hasOwnProperty('extensionsUsed')) {
            if (gltf.extensionsUsed.indexOf('KHR_draco_mesh_compression') !== -1) {
                this.decoderModule = null;
            }
        }
    };

    LoaderContext.prototype.buildHierarchy = function (resources) {
        for (var node, idx = 0; idx < this.gltf.nodes.length; idx++) {
            node = this.gltf.nodes[idx];
            if (node.hasOwnProperty('children')) {
                var context = this;
                for (var child, childIdx = 0; childIdx < node.children.length; childIdx++) {
                    child = context.nodes[childIdx];
                    // If this triggers, a node in the glTF has more than one parent which is wrong
                    if (child.parent) {
                        child.parent.removeChild(child);
                    }
                    var parent = context.nodes[idx];
                    parent.addChild(child);
                }
            }
        }
    };

    LoaderContext.prototype._getRoots = function () {
        var gltf = this.gltf;
        var rootNodes = [];
        if (gltf.hasOwnProperty('scenes')) {
            var sceneIndex = 0;
            if (gltf.hasOwnProperty('scene')) {
                sceneIndex = gltf.scene;
            }
            var nodes = gltf.scenes[sceneIndex].nodes;
            for (var i = 0; i < nodes.length; i++) {
                rootNodes.push(this.nodes[nodes[i]]);
            }
        } else {
            rootNodes.push(this.nodes[0]);
        }
        return rootNodes;
    };

    LoaderContext.prototype._createMeshInstance = function (mesh) {
        var material;
        if (mesh.materialIndex === undefined) {
            material = this.defaultMaterial;
        } else {
            material = this.materials[mesh.materialIndex];
        }

        var meshInstance = new pc.MeshInstance(this.nodes[nodeIndex], mesh, material);
        this._meshInstances.push(meshInstance);

        if (mesh.morph) {
            var morphInstance = new pc.MorphInstance(mesh.morph);
            meshInstance.morphInstance = morphInstance;
            // HACK: need to force calculation of the morph's AABB due to a bug
            // in the engine. This is a private function and will be removed!
            morphInstance.updateBounds(meshInstance.mesh);
            if (mesh.weights) {
                mesh.weights.forEach(function (weight, weightIndex) {
                    morphInstance.setWeight(weightIndex, weight);
                });
            }

            this._morphInstances.push(morphInstance);
        }

        if (node.hasOwnProperty('skin')) {
            var skin = this.skins[node.skin];
            mesh.skin = skin;

            var skinInstance = new pc.SkinInstance(skin);
            skinInstance.bones = skin.bones;
            meshInstance.skinInstance = skinInstance;

            this._skinInstances.push(skinInstance);
        }
    };

    LoaderContext.prototype.createModel = function () {
        var gltf = this.gltf;

        this._meshInstances = [];
        this._skinInstances = [];
        this._morphInstances = [];

        var context = this;
        gltf.nodes.forEach(function (node, nodeIndex) {
            if (node.hasOwnProperty('mesh')) {
                var meshGroup = context.meshes[node.mesh];
                meshGroup.forEach(context._createMeshInstance);
            }
        });

        var model = new pc.Model();
        var roots = this._getRoots();
        if (roots.length === 1) {
            model.graph = roots[0];
        } else {
            model.graph = new pc.GraphNode();
            roots.forEach(function (root) {
                model.graph.addChild(root);
            });
        }
        model.meshInstances = this.meshInstances;
        model.morphInstances = this.morphInstances;
        model.skinInstances = this.skinInstances;

        this.model = model;
    };

    LoaderContext.prototype.parse = function (property, translator) {
        if (this.gltf.hasOwnProperty(property)) {
            var arr = this.gltf[property];
            this[property] = new Array(arr.length);
            for (var idx = 0; idx < arr.length; idx++) {
                this[property][idx] = translator(this, arr[idx]);
            }
        }
    };

    function decodeBinaryUtf8(array) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        var str = "";
        for (var i = 0, len = array.length; i < len; i++) {
            str += String.fromCharCode(array[i]);
        }

        return decodeURIComponent(escape(str));
    }

    return {
        GLBModelParser: GLBModelParser
    };
}());
