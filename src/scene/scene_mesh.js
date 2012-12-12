pc.extend(pc.scene, function () {

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
            // Key definition:
            // Bit
            // 31     - sign bit (leave)
            // 30     - 1 opaque, 0 transparent
            // 0 - 29 - Material ID (if oqaque) or 0 (if transparent - will be depth)
            var material = this.material;
            this.key = material.transparent ? 
                0x00000000 :
                (material.id & 0x3fffffff) | 0x40000000; 
        }
    };

    return {
        Mesh: Mesh,
        MeshInstance: MeshInstance,
    }; 
}());