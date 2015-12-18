pc.extend(pc, function () {
    /**
     * @name pc.Model
     * @class A model is a graphical object that can be added to or removed from a scene.
     * It contains a hierarchy and any number of mesh instances.
     * @description Creates a new model.
     * @example
     * // Create a new model
     * var model = new pc.Model();
     * @property {pc.GraphNode} graph The root node of the model's graph node hierarchy.
     * @property {pc.MeshInstance[]} meshInstances An array of meshInstances contained in this model.
     */
    var Model = function Model() {
        this.graph = null;
        this.meshInstances = [];
        this.skinInstances = [];

        this.cameras = [];
        this.lights = [];

        this._shadersVersion = 0;
    };

    Model.prototype = {
        getGraph: function () {
            return this.graph;
        },

        setGraph: function (graph) {
            this.graph = graph;
        },

        getCameras: function () {
            return this.cameras;
        },

        setCameras: function (cameras) {
            this.cameras = cameras;
        },

        getLights: function () {
            return this.lights;
        },

        setLights: function (lights) {
            this.lights = lights;
        },

        getMaterials: function () {
            var i;
            var materials = [];
            for (i = 0; i < this.meshInstances.length; i++) {
                var meshInstance = this.meshInstances[i];
                if (materials.indexOf(meshInstance.material) === -1) {
                    materials.push(meshInstance.material);
                }
            }
            return materials;
        },

        /**
         * @function
         * @name pc.Model#clone
         * @description Clones a model. The returned model has a newly created hierarchy
         * and mesh instances, but meshes are shared between the clone and the specified
         * model.
         * @returns {pc.Model} A clone of the specified model.
         * @example
         * var clonedModel = model.clone();
         * @author Will Eastcott
         */
    	clone: function () {
            var i;

            // Duplicate the node hierarchy
            var srcNodes = [];
            var cloneNodes = [];

            var _duplicate = function (node) {
                var newNode = node.clone();

                srcNodes.push(node);
                cloneNodes.push(newNode);

                var children = node.getChildren();
                for (var i = 0; i < children.length; i++) {
                    newNode.addChild(_duplicate(children[i]));
                }

                return newNode;
            };

            var cloneGraph = _duplicate(this.graph);
            var cloneMeshInstances = [];
            var cloneSkinInstances = [];

            // Clone the skin instances
            for (i = 0; i < this.skinInstances.length; i++) {
                var skin = this.skinInstances[i].skin;
                var cloneSkinInstance = new pc.SkinInstance(skin);

                // Resolve bone IDs to actual graph nodes
                var bones = [];
                for (j = 0; j < skin.boneNames.length; j++) {
                    var boneName = skin.boneNames[j];
                    var bone = cloneGraph.findByName(boneName);
                    bones.push(bone);
                }
                cloneSkinInstance.bones = bones;

                cloneSkinInstances.push(cloneSkinInstance);
            }

            // Clone the mesh instances
            for (i = 0; i < this.meshInstances.length; i++) {
                var meshInstance = this.meshInstances[i];
                var nodeIndex = srcNodes.indexOf(meshInstance.node);
                var cloneMeshInstance = new pc.MeshInstance(cloneNodes[nodeIndex], meshInstance.mesh, meshInstance.material);

                if (meshInstance.skinInstance) {
                    var skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
                    cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex];
                }

                cloneMeshInstances.push(cloneMeshInstance);
            }

            var clone = new pc.Model();
            clone.graph = cloneGraph;
            clone.meshInstances = cloneMeshInstances;
            clone.skinInstances = cloneSkinInstances;

            clone.getGraph().syncHierarchy();

            return clone;
        },

        /**
         * @function
         * @name pc.Model#generateWireframe
         * @description Generates the necessary internal data for a model to be
         * renderable as wireframe. Once this function has been called, any mesh
         * instance in the model can have its renderStyle property set to
         * pc.RENDERSTYLE_WIREFRAME
         * @example
         * model.generateWireframe();
         * for (var i = 0; i < model.meshInstances.length; i++) {
         *     model.meshInstances[i].renderStyle = pc.RENDERSTYLE_WIREFRAME;
         * }
         * @author Will Eastcott
         */
        generateWireframe: function () {
            var i, j, k;
            var i1, i2;
            var mesh, base, count, indexBuffer, wireBuffer;
            var srcIndices, dstIndices;

            // Build an array of unique meshes in this model
            var meshes = [];
            for (i = 0; i < this.meshInstances.length; i++) {
                mesh = this.meshInstances[i].mesh;
                if (meshes.indexOf(mesh) === -1) {
                    meshes.push(mesh);
                }
            }

            var offsets = [[0, 1], [1, 2], [2, 0]];
            for (i = 0; i < meshes.length; i++) {
                mesh = meshes[i];
                base = mesh.primitive[pc.RENDERSTYLE_SOLID].base;
                count = mesh.primitive[pc.RENDERSTYLE_SOLID].count;
                indexBuffer = mesh.indexBuffer[pc.RENDERSTYLE_SOLID];

                srcIndices = new Uint16Array(indexBuffer.lock());

                var uniqueLineIndices = {};
                var lines = [];
                for (j = base; j < base + count; j+=3) {
                    for (k = 0; k < 3; k++) {
                        i1 = srcIndices[j + offsets[k][0]];
                        i2 = srcIndices[j + offsets[k][1]];
                        var line = (i1 > i2) ? ((i2 << 16) | i1) : ((i1 << 16) | i2);
                        if (uniqueLineIndices[line] === undefined) {
                            uniqueLineIndices[line] = 0;
                            lines.push(i1, i2);
                        }
                    }
                }

                indexBuffer.unlock();

                wireBuffer = new pc.IndexBuffer(indexBuffer.device, pc.INDEXFORMAT_UINT16, lines.length);
                dstIndices = new Uint16Array(wireBuffer.lock());
                dstIndices.set(lines);
                wireBuffer.unlock();

                mesh.primitive[pc.RENDERSTYLE_WIREFRAME] = {
                    type: pc.PRIMITIVE_LINES,
                    base: 0,
                    count: lines.length,
                    indexed: true
                };
                mesh.indexBuffer[pc.RENDERSTYLE_WIREFRAME] = wireBuffer;
            }
        }
    };

    return {
        Model: Model
    };
}());
