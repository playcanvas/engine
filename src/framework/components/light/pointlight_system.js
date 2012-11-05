pc.extend(pc.fw, function () {
    /**
     * @name pc.fw.PointLightComponentSystem
     * @constructor Create a new PointLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var PointLightComponentSystem = function (context) {
        this.id = 'pointlight'
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.PointLightComponent;
        this.DataType = pc.fw.PointLightComponentData;

        this.renderable = _createGfxResources();

        this.bind('remove', this.onRemove.bind(this));
    };
    PointLightComponentSystem = pc.inherits(PointLightComponentSystem, pc.fw.ComponentSystem);

    pc.extend(PointLightComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            var light = new pc.scene.LightNode();
            light.setType(pc.scene.LightType.POINT);

            data.light = light;

            properties = ['light', 'enable', 'color', 'intensity', 'castShadows', 'attenuationEnd'];
            PointLightComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        onRemove: function (entity, data) {
            entity.removeChild(data.light);
            data.light.setEnabled(false);
            delete data.light;
        },

        toolsRender: function (fn) {
            var components = this.getComponents();
            for (var id in components) {
                if (components.hasOwnProperty(id)) {
                    var entity = components[id].entity;
                    var componentData = components[id].component;

                    var position = entity.getPosition();

                    this.renderable.setLocalPosition(position);
                    this.renderable.syncHierarchy();
                    this.renderable.dispatch();
                }
            }
        }
    });

    var _createGfxResources = function () {
        var lightMat = new pc.scene.Material();
        lightMat.setProgramName("basic");
        lightMat.setParameter("uColor",  [1, 1, 0, 1]);

        var sphereGeom = pc.scene.procedural.createSphere({material: lightMat});
        
        var sphereMesh = new pc.scene.MeshNode();
        sphereMesh.setGeometry(sphereGeom);
        
        return sphereMesh;
    };
    
    return {
        PointLightComponentSystem: PointLightComponentSystem
    }; 
}());
