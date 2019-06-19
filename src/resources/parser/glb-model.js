Object.assign(pc, function () {
    'use strict';

    // Take PlayCanvas JSON model data and create pc.Model
    var GLBModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(GLBModelParser.prototype, {
        parse: function (data) {
            var modelData = data.model;
            if (!modelData) {
                return null;
            }

            if (modelData.version <= 1) {
                // #ifdef DEBUG
                console.warn("JsonModelParser#parse: Trying to parse unsupported model format.");
                // #endif
                return null;
            }

            // NODE HIERARCHY
            var nodes = this._parseNodes(data);

            // SKINS
            var skins = this._parseSkins(data, nodes);

            // MORPHS
            var morphs = this._parseMorphs(data, nodes);

            // VERTEX BUFFERS
            var vertexBuffers = this._parseVertexBuffers(data);

            // INDEX BUFFER
            var indices = this._parseIndexBuffers(data, vertexBuffers);

            // MESHES
            var meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

            this._initMorphs(data, morphs.morphs, vertexBuffers, meshes);

            // MESH INSTANCES
            var meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances, morphs.morphs, morphs.instances);

            var model = new pc.Model();
            model.graph = nodes[0];
            model.meshInstances = meshInstances;
            model.skinInstances = skins.instances;
            model.morphInstances = morphs.instances;
            model.getGraph().syncHierarchy();

            return model;
        }
    });

    return {
        GLBModelParser: GLBModelParser
    };
}());
