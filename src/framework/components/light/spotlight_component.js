pc.extend(pc.fw, function () {
    var _createGfxResources = function () {
        var lightMat = new pc.scene.Material();
        lightMat.setProgramName("phong");
        lightMat.setParameter("material_ambient",   [0,0,0]);
        lightMat.setParameter("material_diffuse",   [0,0,0]);
        lightMat.setParameter("material_specular",  [0,0,0]);
        lightMat.setParameter("material_shininess", 1);
        lightMat.setParameter("material_emissive",  [1,1,0]);
        lightMat.setParameter("material_opacity",   1);

        return pc.scene.procedural.createSphere({material: lightMat});
    };

    /**
     * @name pc.fw.SpotLightComponentSystem
     * @constructor Create a new SpotLightComponentSystem
     * @class A Light Component is used to dynamically light the scene.
     * @param {Object} context
     * @extends pc.fw.ComponentSystem
     */
    var SpotLightComponentSystem = function (context) {
        context.systems.add("spotlight", this);

        this.renderable = _createGfxResources();

        // Handle changes to the 'attenuationEnd' value
        this.bind("set_attenuationEnd", this.onSetAttenuationEnd.bind(this));
        // Handle changes to the 'castShadows' value
        this.bind("set_castShadows", this.onSetCastShadows.bind(this));
        // Handle changes to the 'enable' value
        this.bind("set_color", this.onSetColor.bind(this));
        // Handle changes to the 'enable' value
        this.bind("set_enable", this.onSetEnable.bind(this));
        // Handle changes to the 'intensity' value
        this.bind("set_intensity", this.onSetIntensity.bind(this));
        // Handle changes to the 'light' value
        this.bind("set_light", this.onSetLight.bind(this));
        // Handle changes to the 'outerConeAngle' value
        this.bind("set_outerConeAngle", this.onSetConeAngle.bind(this));
    };

    SpotLightComponentSystem = SpotLightComponentSystem.extendsFrom(pc.fw.ComponentSystem);

    SpotLightComponentSystem.prototype.createComponent = function (entity, data) {
        var componentData = new pc.fw.SpotLightComponentData();

        var light = new pc.scene.LightNode();
        light.setType(pc.scene.LightType.SPOT);

        data = data || {};
        data.light = light;

        this.initialiseComponent(entity, componentData, data, ['light', 'color', 'intensity', 'attenuationEnd', 'outerConeAngle', 'enable']);

        return componentData;
    };
    
    SpotLightComponentSystem.prototype.deleteComponent = function (entity) {
        var componentData = this.getComponentData(entity);
        entity.removeChild(componentData.light);
        componentData.light.setEnabled(false);
        delete componentData.light;

        this.removeComponent(entity);
    };

    SpotLightComponentSystem.prototype.toolsRender = function (fn) {
        var components = this.getComponents();
        for (var id in components) {
            if (components.hasOwnProperty(id)) {
                var entity = components[id].entity;
                var componentData = components[id].component;

                var transform = entity.getWorldTransform();
                this.renderable.dispatch(transform);
            }
        }
    };

    SpotLightComponentSystem.prototype.onSetAttenuationEnd = function (entity, name, oldValue, newValue) {
        if (newValue) {
            var componentData = this.getComponentData(entity);
            componentData.light.setAttenuationEnd(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetCastShadows = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setCastShadows(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetColor = function (entity, name, oldValue, newValue) {
        if (newValue) {
            var componentData = this.getComponentData(entity);
            var rgb = parseInt(newValue);
            rgb = pc.math.intToBytes24(rgb);
            var color = [
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            ];
            componentData.light.setColor(color);
        }
    };

    SpotLightComponentSystem.prototype.onSetConeAngle = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setInnerConeAngle(newValue - 5);
            componentData.light.setOuterConeAngle(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetEnable = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setEnabled(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetIntensity = function (entity, name, oldValue, newValue) {
        if (newValue !== undefined) {
            var componentData = this.getComponentData(entity);
            componentData.light.setIntensity(newValue);
        }
    };

    SpotLightComponentSystem.prototype.onSetLight = function (entity, name, oldValue, newValue) {
        if (oldValue) {
            entity.removeChild(oldValue);
        }
        if (newValue) {
            entity.addChild(newValue);
        }
    };
    
    return {
        SpotLightComponentSystem: SpotLightComponentSystem
    }; 
}());
