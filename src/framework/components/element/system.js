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

            if (data.hAlign !== undefined) component.hAlign = data.hAlign;
            if (data.vAlign !== undefined) component.vAlign = data.vAlign;
            if (data.hAnchor !== undefined) component.hAnchor = data.hAnchor;
            if (data.vAnchor !== undefined) component.vAnchor = data.vAnchor;

            ElementComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        }
    });

    return {
        ElementComponentSystem: ElementComponentSystem
    }
}());
