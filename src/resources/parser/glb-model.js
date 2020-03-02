Object.assign(pc, function () {
    'use strict';

    var GlbModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GlbModelParser.prototype, {
        parse: function (data, callback) {
            var self = this;
            pc.GlbParser.parse(data, this._device, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    // construct model
                    callback(null, self.createModel(result));
                }
            });
        },

        createModel: function (glb) {
            var model = new pc.Model();

            var rootNodes = [];
            for (var i = 0; i < glb.nodes.length; i++) {
                var node = glb.nodes[i];
                if (node.parent === null) {
                    rootNodes.push(node);
                }

                var nodeData = glb.gltf.nodes[i];
                if (nodeData.hasOwnProperty('mesh')) {
                    var meshGroup = glb.meshes[nodeData.mesh];
                    for (var mi = 0; mi < meshGroup.length; mi++) {
                        this.createMeshInstance(model, meshGroup[mi], glb.skins, glb.materials, node, nodeData);
                    }
                }
            }

            // set model root (create a group if there is more than one)
            if (rootNodes.length === 1) {
                model.graph = rootNodes[0];
            } else {
                model.graph = new pc.GraphNode('SceneGroup');
                for (var i = 0; i < rootNodes.length; ++i) {
                    model.graph.addChild(rootNodes[i]);
                }
            }

            return model;
        },

        createMeshInstance: function (model, mesh, skins, materials, node, nodeData) {
            var material = (mesh.materialIndex === undefined) ? this._defaultMaterial : materials[mesh.materialIndex];

            var meshInstance = new pc.MeshInstance(node, mesh, material);

            if (mesh.morph) {
                var morphInstance = new pc.MorphInstance(mesh.morph);
                // HACK: need to force calculation of the morph's AABB due to a bug
                // in the engine. This is a private function and will be removed!
                morphInstance.updateBounds(meshInstance.mesh);
                if (mesh.weights) {
                    for (var wi = 0; wi < mesh.weights.length; wi++) {
                        morphInstance.setWeight(wi, mesh.weights[wi]);
                    }
                }

                meshInstance.morphInstance = morphInstance;
                model.morphInstances.push(morphInstance);
            }

            if (nodeData.hasOwnProperty('skin')) {
                var skin = skins[nodeData.skin];
                mesh.skin = skin;

                var skinInstance = new pc.SkinInstance(skin);
                skinInstance.bones = skin.bones;

                meshInstance.skinInstance = skinInstance;
                model.skinInstances.push(skinInstance);
            }

            model.meshInstances.push(meshInstance);
        }
    });

    return {
        GlbModelParser: GlbModelParser
    };
}());
