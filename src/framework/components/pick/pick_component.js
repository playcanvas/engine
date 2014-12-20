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
                    mesh = pc.procedural.createBox(this.system.context.graphicsDevice, {
                        halfExtents: shape.halfExtents
                    });
                    break;
                case pc.shape.Type.SPHERE:
                    mesh = pc.procedural.createSphere(this.system.context.graphicsDevice, {
                        radius: shape.radius
                    });
                    break;
                case pc.shape.Type.TORUS:
                    mesh = pc.procedural.createTorus(this.system.context.graphicsDevice, {
                        tubeRadius: shape.iradius,
                        ringRadius: shape.oradius
                    });
                    break;
            }

            var node = new pc.GraphNode();
            var meshInstance = new pc.MeshInstance(node, mesh, material);

            meshInstance._entity = this.entity;

            var model = new pc.Model();
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
