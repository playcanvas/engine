pc.extend(pc.fw, function () {
    
    /**
     * @name pc.fw.PickComponent
     * @constructor Create a new PickComponent
     * @class Allows an Entity to be picked from the scene using a pc.fw.picking.Picker Object
     * @param {Object} context
     * @extends pc.fw.Component
     */
    var PickComponent = function PickComponent(context) {
    };
    PickComponent = pc.inherits(PickComponent, pc.fw.Component);
    
    pc.extend(PickComponent.prototype, {
        addShape: function (shape, shapeName) {
            var material = this.data.material;
            var geometry = null;

            switch (shape.type) {
                case pc.shape.Type.BOX:
                    geometry = pc.scene.procedural.createBox({
                        material: material, 
                        halfExtents: shape.halfExtents
                    });
                    break;
                case pc.shape.Type.SPHERE:
                    geometry = pc.scene.procedural.createSphere({
                        material: material,
                        radius: shape.radius
                    });
                    break;
                case pc.shape.Type.TORUS:
                    geometry = pc.scene.procedural.createTorus({
                        material: material,
                        tubeRadius: shape.iradius,
                        ringRadius: shape.oradius
                    });
                    break;
            }

            var mesh = new pc.scene.MeshNode();
            mesh.setGeometry(geometry);

            var model = new pc.scene.Model();
            model.getGeometries().push(geometry);
            model.getMaterials().push(material);
            model.getMeshes().push(mesh);
            model.setGraph(mesh);

            model._entity = this.entity;

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
