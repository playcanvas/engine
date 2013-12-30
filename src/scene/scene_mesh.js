pc.extend(pc.scene, function () {
    function getKey(layer, blendType, isCommand, materialId) {
        // Key definition:
        // Bit
        // 31      : sign bit (leave)
        // 28 - 30 : layer
        // 26 - 27 : translucency type (opaque: 3, normal, additive, subtractive)
        // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
        // 0 - 24  : Material ID (if oqaque) or 0 (if transparent - will be depth)
        return ((layer & 0x7) << 28) |
               ((blendType & 0x3) << 26) |
               ((isCommand ? 1 : 0) << 25) |
               ((materialId & 0x1ffffff) << 0);
    }

    /**
     * @name pc.scene.Mesh
     * @class A graphical primitive.
     */
    var Mesh = function () {
        this.vertexBuffer = null;
        this.indexBuffer = [ null ];
        this.primitive = [{
            type: 0,
            base: 0,
            count: 0
        }];
        this.skin = null;

        // AABB for object space mesh vertices
        this.aabb = new pc.shape.Aabb();
    };

    /**
     * @name pc.scene.MeshInstance
     * @class A instance of a pc.scene.Mesh. A single mesh can be referenced by many instances
     * that can have different transforms and materials.
     * @param {pc.scene.GraphNode} node The graph node defining the transform for this instance.
     * @param {pc.scene.Mesh} mesh The graphics mesh being instanced.
     * @param {pc.scene.Material} material The material used to render this instance.
     */
    var MeshInstance = function MeshInstance(node, mesh, material) {
        this.node = node;           // The node that defines the transform of the mesh instance
        this.mesh = mesh;           // The mesh that this instance renders
        this.material = material;   // The material with which to render this instance

        // Render options
        this.layer = pc.scene.LAYER_WORLD;
        this.renderStyle = pc.scene.RENDERSTYLE_SOLID;
        this.castShadow = false;
        this.receiveShadow = true;

        // 64-bit integer key that defines render order of this mesh instance
        this.key = 0;
        this.updateKey();

        this.skinInstance = null;

        // World space AABB
        this.aabb = new pc.shape.Aabb();
        this.normalMatrix = new pc.Matrix3();
    };

    Object.defineProperty(MeshInstance.prototype, 'material', {
        get: function () {
            return this._material;
        },
        set: function (material) {
            // Remove the material's reference to this mesh instance
            if (this._material) {
                var meshInstances = this._material.meshInstances;
                var index = meshInstances.indexOf(this);
                if (index !== -1) {
                    meshInstances.splice(index, 1);
                }
            }

            this._material = material;

            // Record that the material is referenced by this mesh instance
            this._material.meshInstances.push(this);

            this.updateKey();
        }
    });

    Object.defineProperty(MeshInstance.prototype, 'layer', {
        get: function () {
            return this._layer;
        },
        set: function (layer) {
            this._layer = layer;
            this.updateKey();
        }
    });

    pc.extend(MeshInstance.prototype, {
        syncAabb: function () {
            this.aabb.setFromTransformedAabb(this.mesh.aabb, this.node.worldTransform);
        },

        updateKey: function () {
            var material = this.material;
            this.key = getKey(this.layer, material.blendType, false, material.id);
        }
    });

    var Command = function (layer, blendType, command) {
        this.key = getKey(layer, blendType, true, 0);
        this.command = command;
    };

    return {
        Command: Command,
        Mesh: Mesh,
        MeshInstance: MeshInstance
    }; 
}());