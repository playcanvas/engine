Object.assign(pc, function () {
    var _schema = [
        { name: 'enabled', type: 'boolean' },
        { name: 'horizontal', type: 'boolean' },
        { name: 'vertical', type: 'boolean' },
        { name: 'scrollMode', type: 'number' },
        { name: 'bounceAmount', type: 'number' },
        { name: 'friction', type: 'number' },
        { name: 'dragThreshold', type: 'number' },
        { name: 'horizontalScrollbarVisibility', type: 'number' },
        { name: 'verticalScrollbarVisibility', type: 'number' },
        { name: 'viewportEntity', type: 'entity' },
        { name: 'contentEntity', type: 'entity' },
        { name: 'horizontalScrollbarEntity', type: 'entity' },
        { name: 'verticalScrollbarEntity', type: 'entity' }
    ];

    var DEFAULT_DRAG_THRESHOLD = 10;

    /**
     * @private
     * @name pc.ScrollViewComponentSystem
     * @description Create a new ScrollViewComponentSystem
     * @classdesc Manages creation of {@link pc.ScrollViewComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ScrollViewComponentSystem = function ScrollViewComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'scrollview';
        this.app = app;

        this.ComponentType = pc.ScrollViewComponent;
        this.DataType = pc.ScrollViewComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);

        pc.ComponentSystem.bind('update', this.onUpdate, this);
    };
    ScrollViewComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    ScrollViewComponentSystem.prototype.constructor = ScrollViewComponentSystem;

    pc.Component._buildAccessors(pc.ScrollViewComponent.prototype, _schema);

    Object.assign(ScrollViewComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.dragThreshold === undefined) {
                data.dragThreshold = DEFAULT_DRAG_THRESHOLD;
            }

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, _schema);
        },

        onUpdate: function (dt) {
            var components = this.store;

            for (var id in components) {
                var entity = components[id].entity;
                var component = entity.scrollview;
                if (component.enabled && entity.enabled) {
                    component.onUpdate();
                }

            }
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ScrollViewComponentSystem: ScrollViewComponentSystem
    };
}());
