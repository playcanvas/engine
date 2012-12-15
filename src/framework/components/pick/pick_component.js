pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.PickComponent
     * @constructor Create a new PickComponent
     * @class Allows an Entity to be picked from the scene using a pc.fw.picking.Picker Object
    * @param {pc.fw.PickComponentSystem} system The ComponentSystem that created this Component
    * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
     */
    var PickComponent = function PickComponent(system, entity) {
    };
    PickComponent = pc.inherits(PickComponent, pc.fw.Component);
    
    pc.extend(PickComponent.prototype, {
        addShape: function (shape, shapeName) {
            var material = this.data.material;
            var mesh = null;

            switch (shape.type) {
                case pc.shape.Type.BOX:
                    mesh = pc.scene.procedural.createBox({
                        halfExtents: shape.halfExtents
                    });
                    break;
                case pc.shape.Type.SPHERE:
                    mesh = pc.scene.procedural.createSphere({
                        radius: shape.radius
                    });
                    break;
                case pc.shape.Type.TORUS:
                    mesh = pc.scene.procedural.createTorus({
                        tubeRadius: shape.iradius,
                        ringRadius: shape.oradius
                    });
                    break;
            }

            var node = new pc.scene.GraphNode();
            var meshInstance = new pc.scene.MeshInstance(node, mesh, material);

            meshInstance._entity = this.entity;

            var model = new pc.scene.Model();
            model.graph = node;
            model.meshInstances = [ meshInstance ];

            var shape = {
                shape: shape,
                shapeName: shapeName,
                model: model
            };

            this.data.shapes.push(shape);
            this.system.addShape(this.data.layer, shape);
        },

        deleteShapes: function () {
            this.system.deleteShapes(this.data.layer, this.data.shapes);
            this.data.shapes = [];
        }
    });

    return {
        PickComponent: PickComponent
    };
}());
