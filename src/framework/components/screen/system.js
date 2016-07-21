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

            if (data.resolution !== undefined) component.resolution = data.resolution;
            // if (data.screenSpace !== undefined) component.screenSpace = data.screenSpace;

            ScreenComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                components[id].entity.screen.update(dt);
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
