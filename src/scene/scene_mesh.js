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
        this.aabb = null;
    };

    var MeshInstance = function (node, mesh, material) {
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
    };

    MeshInstance.prototype = {
        syncAabb: function () {
            this.aabb.setFromTransformedAabb(this.mesh.aabb, this.node.worldTransform);
        },

        updateKey: function () {
            var material = this.material;
            this.key = getKey(this.layer, material.blendType, false, material.id);
        }
    };

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