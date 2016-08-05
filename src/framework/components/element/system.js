pc.extend(pc, function () {
    /**
     * @name pc.ElementComponentSystem
     * @description Create a new ElementComponentSystem
     * @class Attach 2D text to an entity
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ElementComponentSystem = function ElementComponentSystem(app) {
        this.id = 'element';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ElementComponent;
        this.DataType = pc.ElementComponentData;

        this.schema = [ 'enabled' ];
    };
    ElementComponentSystem = pc.inherits(ElementComponentSystem, pc.ComponentSystem);

    pc.extend(ElementComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.width !== undefined) component.width = data.width;
            if (data.height !== undefined) component.height = data.height
            if (data.anchor !== undefined) component.anchor = new pc.Vec4(data.anchor.x, data.anchor.y, data.anchor.z, data.anchor.w);
            if (data.pivot !== undefined) component.pivot = new pc.Vec2(data.pivot.x, data.pivot.y);

            ElementComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    }
}());
