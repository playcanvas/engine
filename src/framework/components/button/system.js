pc.extend(pc, function () {
    var _schema = [
        'active',
        'imageEntity',
        'textEntity',
        { name: 'hitPadding', type: 'vec4' },
        'transitionMode',
        { name: 'hoverTint', type: 'rgba' },
        { name: 'pressedTint', type: 'rgba' },
        { name: 'inactiveTint', type: 'rgba' },
        'fadeDuration',
        'hoverAsset',
        'pressedAsset',
        'inactiveAsset'
    ];

    /**
     * @private
     * @name pc.ButtonComponentSystem
     * @description Create a new ButtonComponentSystem
     * @classdesc Manages creation of {@link pc.ButtonComponent}s.
     * @param {pc.Application} app The application
     * @extends pc.ComponentSystem
     */
    var ButtonComponentSystem = function ButtonComponentSystem(app) {
        this.id = 'button';
        this.app = app;
        app.systems.add(this.id, this);

        this.ComponentType = pc.ButtonComponent;
        this.DataType = pc.ButtonComponentData;

        this.schema = _schema;

        this.on('beforeremove', this._onRemoveComponent, this);
    };
    ButtonComponentSystem = pc.inherits(ButtonComponentSystem, pc.ComponentSystem);

    pc.Component._buildAccessors(pc.ButtonComponent.prototype, _schema);

    pc.extend(ButtonComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {
            ButtonComponentSystem._super.initializeComponentData.call(this, component, data, _schema);
        },

        cloneComponent: function (entity, clone) {
            // TODO Need to resolve imageEntity and textEntity references here (or on some
            //      sort of post-clone callback) so that they are correctly resolved to the
            //      corresponding newly-created image and text entities.

            return ButtonComponentSystem._super.cloneComponent(entity, clone);
        },

        _onRemoveComponent: function (entity, component) {
            component.onRemove();
        }
    });

    return {
        ButtonComponentSystem: ButtonComponentSystem
    };
}());
