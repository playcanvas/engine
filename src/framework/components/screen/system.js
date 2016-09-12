pc.extend(pc, function () {
    /**
     * @name pc.ScreenComponentSystem
     * @description Create a new ScreenComponentSystem
     * @class Attach 2D text to an entity
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */

    var ScreenComponentSystem = function ScreenComponentSystem(app) {
        this.id = 'screen';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ScreenComponent;
        this.DataType = pc.ScreenComponentData;

        this.schema = [ 'enabled' ];

        this.windowResolution = new pc.Vec2();
        this.app.graphicsDevice.on("resizecanvas", this._onResize, this);

        pc.ComponentSystem.on('update', this._onUpdate, this);
    };
    ScreenComponentSystem = pc.inherits(ScreenComponentSystem, pc.ComponentSystem);

    pc.extend(ScreenComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.screenSpace !== undefined) component.screenSpace = data.screenSpace;
            if (data.scaleMode !== undefined) component.scaleMode = data.scaleMode;
            if (data.scaleBlend !== undefined) component.scaleBlend = data.scaleBlend;
            if (data.resolution !== undefined) {
                if (data.resolution instanceof pc.Vec2){
                    component._resolution.copy(data.resolution);
                } else {
                    component._resolution.set(data.resolution[0], data.resolution[1]);
                }
                component.resolution = component._resolution;
            }
            if (data.referenceResolution !== undefined) {
                if (data.referenceResolution instanceof pc.Vec2){
                    component._referenceResolution.copy(data.referenceResolution);
                } else {
                    component._referenceResolution.set(data.referenceResolution[0], data.referenceResolution[1]);
                }
                component.referenceResolution = component._referenceResolution;
            }

            ScreenComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                if (components[id].entity.screen.update) components[id].entity.screen.update(dt);
            }
        },

        _onResize: function (width, height) {
            this.windowResolution.x = width;
            this.windowResolution.y = height;
        }
    });

    return {
        ScreenComponentSystem: ScreenComponentSystem
    }
}());
