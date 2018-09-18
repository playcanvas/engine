Object.assign(pc, function () {
    var _schema = ['enabled'];

    /**
     * @private
     * @name pc.LayoutChildComponentSystem
     * @description Create a new LayoutChildComponentSystem
     * @classdesc Manages creation of {@link pc.LayoutChildComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var LayoutChildComponentSystem = function LayoutChildComponentSystem(app) {
        pc.ComponentSystem.call(this, app);

        this.id = 'layoutchild';
        this.app = app;

        this.ComponentType = pc.LayoutChildComponent;
        this.DataType = pc.LayoutChildComponentData;

        this.schema = _schema;
    };
    LayoutChildComponentSystem.prototype = Object.create(pc.ComponentSystem.prototype);
    LayoutChildComponentSystem.prototype.constructor = LayoutChildComponentSystem;

    pc.Component._buildAccessors(pc.LayoutChildComponent.prototype, _schema);

    Object.assign(LayoutChildComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            if (data.enabled !== undefined) component.enabled = data.enabled;
            if (data.minWidth !== undefined) component.minWidth = data.minWidth;
            if (data.minHeight !== undefined) component.minHeight = data.minHeight;
            if (data.maxWidth !== undefined) component.maxWidth = data.maxWidth;
            if (data.maxHeight !== undefined) component.maxHeight = data.maxHeight;
            if (data.fitWidthProportion !== undefined) component.fitWidthProportion = data.fitWidthProportion;
            if (data.fitHeightProportion !== undefined) component.fitHeightProportion = data.fitHeightProportion;
            if (data.excludeFromLayout !== undefined) component.excludeFromLayout = data.excludeFromLayout;

            pc.ComponentSystem.prototype.initializeComponentData.call(this, component, data, properties);
        },

        cloneComponent: function (entity, clone) {
            var layoutChild = entity.layoutchild;

            return this.addComponent(clone, {
                enabled: layoutChild.enabled,
                minWidth: layoutChild.minWidth,
                minHeight: layoutChild.minHeight,
                maxWidth: layoutChild.maxWidth,
                maxHeight: layoutChild.maxHeight,
                fitWidthProportion: layoutChild.fitWidthProportion,
                fitHeightProportion: layoutChild.fitHeightProportion,
                excludeFromLayout: layoutChild.excludeFromLayout
            });
        }
    });

    return {
        LayoutChildComponentSystem: LayoutChildComponentSystem
    };
}());
