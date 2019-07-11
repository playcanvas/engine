Object.assign(pc, function () {
    'use strict';

    // Takes GLB file data and create pc.Model
    var GLBModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GLBModelParser.prototype, {
        parse: function (glb, onLoaded, onFailed) {
            var decoder = new pc.GLBHelpers.GLTFDecoder(glb, onFailed);
            var gltf = decoder.parseGLTF(onFailed);
            if (!gltf)
                return;
            var buffers = decoder.extractBuffers(glb, onFailed);
            if (!buffers)
                return;

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
        try {
            this.parse('textures', pc.GLBHelpers.translateTexture);

            var imgLoader = new pc.GLBHelpers.ImageLoader(this, function () {
                try {
                    this.parse('materials', pc.GLBHelpers.translateMaterial);
                    this.parse('meshes', pc.GLBHelpers.translateMesh);
                    var nodeLoader = new pc.GLBHelpers.NodeLoader();
                    this.parse('nodes', nodeLoader.translate.bind(nodeLoader));
                    this.parse('skins', pc.GLBHelpers.translateSkin);
                    var animLoader = new pc.GLBHelpers.AnimationLoader();
                    this.parse('animations', animLoader.translate.bind(animLoader));

                    this.finalize();
                } catch (err) {
                    this._onFailed(err);
                }
            }.bind(this));
            this.parse('images', imgLoader.translate.bind(imgLoader));
        } catch (err) {
            this._onFailed(err);
        }
    };

    LoaderContext.prototype.finalize = function () {
        if (this.gltf.hasOwnProperty('extras') && this.processGlobalExtras)
            this.processGlobalExtras(this.gltf.extras);

        this.buildHierarchy();
        this.createModel();

        this._onLoaded([this.model].concat(this.materials || []).concat(this.textures || []).concat(this.animations || []));

        if (this.gltf.hasOwnProperty('extensionsUsed')) {
            if (this.gltf.extensionsUsed.indexOf('KHR_draco_mesh_compression') !== -1) {
                this.decoderModule = null;
            }
        }
    };

    LoaderContext.prototype.buildHierarchy = function (resources) {
        for (var node, idx = 0; idx < this.gltf.nodes.length; idx++) {
            node = this.gltf.nodes[idx];
            if (node.hasOwnProperty('children')) {
                for (var child, childIdx = 0; childIdx < node.children.length; childIdx++) {
                    child = this.nodes[node.children[childIdx]];
                    // If this triggers, a node in the glTF has more than one parent which is wrong
                    if (child.parent) {
                        child.parent.removeChild(child);
                    }
                    var parent = this.nodes[idx];
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

    LoaderContext.prototype._createMeshInstance = function (mesh, nodeIdx) {
        var material;
        if (mesh.materialIndex === undefined) {
            material = this.defaultMaterial;
        } else {
            material = this.materials[mesh.materialIndex];
        }

        var meshInstance = new pc.MeshInstance(this.nodes[nodeIdx], mesh, material);
        this._meshInstances.push(meshInstance);

        if (mesh.morph) {
            var morphInstance = new pc.MorphInstance(mesh.morph);
            meshInstance.morphInstance = morphInstance;
            // HACK: need to force calculation of the morph's AABB due to a bug
            // in the engine. This is a private function and will be removed!
            morphInstance.updateBounds(meshInstance.mesh);
            if (mesh.weights) {
                for (var wi = 0; wi < mesh.weights.length; wi++) {
                    morphInstance.setWeight(wi, mesh.weights[wi]);
                }
            }

            this._morphInstances.push(morphInstance);
        }

        var node = this.gltf.nodes[nodeIdx];
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

        for (var node, i = 0; i < gltf.nodes.length; i++) {
            node = gltf.nodes[i];
            if (node.hasOwnProperty('mesh')) {
                var meshGroup = this.meshes[node.mesh];
                for (var mi = 0; mi < meshGroup.length; mi++) {
                    this._createMeshInstance(meshGroup[mi], i);
                }
            }
        }

        var model = new pc.Model();
        var roots = this._getRoots();
        if (roots.length === 1) {
            model.graph = roots[0];
        } else {
            model.graph = new pc.GraphNode();
            for (var ri = 0; ri < roots.length; ri++) {
                model.graph.addChild(roots[ri]);
            }
        }
        model.meshInstances = this._meshInstances;
        model.morphInstances = this._morphInstances;
        model.skinInstances = this._skinInstances;

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

    return {
        GLBModelParser: GLBModelParser
    };
}());
