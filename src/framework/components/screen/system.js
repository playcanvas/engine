Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @constructor
     * @name pc.ScreenComponentSystem
     * @classdesc Manages creation of {@link pc.ScreenComponent}s.
     * @description Create a new ScreenComponentSystem
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ScreenComponentSystem = function ScreenComponentSystem(app) {
        this.id = 'screen';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ScreenComponent;
        this.DataType = pc.ScreenComponentData;

        this.schema = _schema;

        this.windowResolution = new pc.Vec2();

        // queue of callbacks
        this._preUpdateQueue = new pc.IndexedList('id');

        this.app.graphicsDevice.on("resizecanvas", this._onResize, this);

        pc.ComponentSystem.on('update', this._onUpdate, this);

        this.on('beforeremove', this.onRemoveComponent, this);
    };
    ScreenComponentSystem = pc.inherits(ScreenComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ScreenComponent.prototype, _schema);

    Object.assign(ScreenComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.priority !== undefined) component.priority = data.priority;
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

            // queue up a draw order sync
            component.syncDrawOrder();

            ScreenComponentSystem._super.initializeComponentData.call(this, component, data, properties);
        },

        _onUpdate: function (dt) {
            this.processPreUpdateQueue();

            var components = this.store;

            for (var id in components) {
                if (components[id].entity.screen.update) components[id].entity.screen.update(dt);
            }
        },

        _onResize: function (width, height) {
            this.windowResolution.x = width;
            this.windowResolution.y = height;
        },

        cloneComponent: function (entity, clone) {
            var screen = entity.screen;

            return this.addComponent(clone, {
                enabled: screen.enabled,
                screenSpace: screen.screenSpace,
                scaleMode: screen.scaleMode,
                resolution: screen.resolution.clone(),
                referenceResolution: screen.referenceResolution.clone()
            });
        },

        onRemoveComponent: function (entity, component) {
            component.onRemove();
        },

        processPreUpdateQueue: function () {
            var list = this._preUpdateQueue.list();

            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                item.callback.call(item.scope);
            }
            this._preUpdateQueue.clear();
        },

        queueCallback: function (id, fn, scope) {
            if (!this._preUpdateQueue.has(id)) {
                this._preUpdateQueue.push(id, {
                    callback: fn,
                    scope: scope
                });
            }
        },

    });

    return {
        ScreenComponentSystem: ScreenComponentSystem
    };
}());
